import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAgent } from "../agents/create.js";
import {
  getAgentById,
  getAllAgents,
  getTransactionsByAgent,
  updateAgentStatus,
  updateAgentUSDPolicy,
  updateAgentWebhook,
  updateAgentExecutionMode,
  getPolicyVersions,
  insertCapitalEvent,
} from "../db.js";
import { getDailySpend } from "../spend/tracker.js";
import { authMiddleware } from "../auth.js";
import { getConnection } from "../rpc.js";
import type { AgentPolicy, USDPolicy } from "../policy/types.js";
import { computeLedgerState } from "../fiat/ledger.js";
import { exportAccountingCSV } from "../fiat/export.js";
import { getPortfolioUSD } from "../usd/valuation.js";
import { listPendingTx, approvePendingTx, rejectPendingTx } from "../hitl/approval.js";
import { getAuditLog, exportAuditJSON } from "../audit/trail.js";
import { v4 as uuidv4 } from "uuid";

const CreateAgentSchema = z.object({
  policy: z
    .object({
      allowedIntents: z.array(z.string()).optional(),
      allowedMints: z.array(z.string()).optional(),
      maxTxAmountSOL: z.number().positive().optional(),
      dailySpendLimitSOL: z.number().positive().optional(),
      maxSlippageBps: z.number().int().min(0).max(10000).optional(),
      requireSimulation: z.boolean().optional(),
      cooldownMs: z.number().int().min(0).optional(),
      maxRiskScore: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  usdPolicy: z
    .object({
      maxTransactionUSD: z.number().positive().optional(),
      maxDailyExposureUSD: z.number().positive().optional(),
      maxPortfolioExposurePercentage: z.number().min(0).max(100).optional(),
      maxDrawdownUSD: z.number().positive().optional(),
    })
    .optional(),
  webhookUrl: z.string().url().optional(),
  executionMode: z.enum(["autonomous", "supervised"]).optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["active", "paused", "suspended"]),
});

const UpdateExecutionModeSchema = z.object({
  mode: z.enum(["autonomous", "supervised"]),
});

const UpdateUSDPolicySchema = z.object({
  maxTransactionUSD: z.number().positive().optional(),
  maxDailyExposureUSD: z.number().positive().optional(),
  maxPortfolioExposurePercentage: z.number().min(0).max(100).optional(),
  maxDrawdownUSD: z.number().positive().optional(),
});

const FundingEventSchema = z.object({
  amountSol: z.number().positive(),
  amountUsd: z.number().positive(),
  sourceNote: z.string().optional(),
});

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agents", async (_request, reply) => {
    const agents = getAllAgents();
    return reply.send({
      agents: agents.map((a) => ({
        id: a.id,
        publicKey: a.public_key,
        status: a.status,
        executionMode: a.execution_mode ?? "autonomous",
        createdAt: a.created_at,
        reputationScore: a.reputation_score ?? 1.0,
      })),
    });
  });

  app.post("/agents", async (request, reply) => {
    const body = CreateAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
    }

    try {
      const result = await createAgent(body.data.policy as Partial<AgentPolicy>);

      if (body.data.usdPolicy) {
        updateAgentUSDPolicy(result.agentId, JSON.stringify(body.data.usdPolicy));
      }
      if (body.data.webhookUrl) {
        updateAgentWebhook(result.agentId, body.data.webhookUrl);
      }
      if (body.data.executionMode) {
        updateAgentExecutionMode(result.agentId, body.data.executionMode);
      }

      return reply.status(201).send({
        agentId: result.agentId,
        publicKey: result.publicKey,
        apiKey: result.apiKey,
        note: "save your apiKey — it will not be shown again",
      });
    } catch (e) {
      return reply.status(500).send({ error: (e as Error).message });
    }
  });

  app.get<{ Params: { id: string } }>("/agents/:id", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });
    const policy = JSON.parse(agent.policy_json) as AgentPolicy;
    const usdPolicy = agent.usd_policy_json ? JSON.parse(agent.usd_policy_json) as USDPolicy : null;
    return reply.send({
      agentId: agent.id,
      publicKey: agent.public_key,
      status: agent.status,
      executionMode: agent.execution_mode ?? "autonomous",
      createdAt: agent.created_at,
      lastActivityAt: agent.last_activity_at ?? null,
      reputationScore: agent.reputation_score ?? 1.0,
      policy,
      usdPolicy,
      webhookUrl: agent.webhook_url ?? null,
    });
  });

  app.patch<{ Params: { id: string } }>(
    "/agents/:id/status",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      const body = UpdateStatusSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
      }

      updateAgentStatus(agent.id, body.data.status);
      return reply.send({ agentId: agent.id, status: body.data.status });
    }
  );

  app.patch<{ Params: { id: string } }>(
    "/agents/:id/execution-mode",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      const body = UpdateExecutionModeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
      }

      updateAgentExecutionMode(agent.id, body.data.mode);
      return reply.send({ agentId: agent.id, executionMode: body.data.mode });
    }
  );

  app.patch<{ Params: { id: string } }>(
    "/agents/:id/usd-policy",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      const body = UpdateUSDPolicySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
      }

      updateAgentUSDPolicy(agent.id, JSON.stringify(body.data));
      return reply.send({ agentId: agent.id, usdPolicy: body.data });
    }
  );

  app.get<{ Params: { id: string } }>("/agents/:id/balance", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });

    try {
      const connection = getConnection();
      const pk = new PublicKey(agent.public_key);
      const lamports = await connection.getBalance(pk, "confirmed");
      const spend = getDailySpend(agent.id);
      return reply.send({
        agentId: agent.id,
        publicKey: agent.public_key,
        balanceSol: lamports / LAMPORTS_PER_SOL,
        balanceLamports: lamports,
        dailySpend: spend,
      });
    } catch (e) {
      return reply.status(500).send({ error: (e as Error).message });
    }
  });

  app.post<{ Params: { id: string }; Body: { amount?: number } }>(
    "/agents/:id/airdrop",
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      const amount = request.body?.amount ?? 1;
      if (amount <= 0 || amount > 5) {
        return reply.status(400).send({ error: "amount must be between 0 and 5 SOL" });
      }

      try {
        const connection = getConnection();
        const pk = new PublicKey(agent.public_key);
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
        const sig = await connection.requestAirdrop(pk, lamports);
        await connection.confirmTransaction(sig, "confirmed");
        const balance = await connection.getBalance(pk, "confirmed");
        return reply.send({
          signature: sig,
          airdropSol: amount,
          newBalanceSol: balance / LAMPORTS_PER_SOL,
          publicKey: agent.public_key,
        });
      } catch (e) {
        return reply.status(500).send({ error: (e as Error).message });
      }
    }
  );

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/agents/:id/transactions",
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });
      const limit = parseInt(request.query.limit ?? "50", 10);
      const txs = getTransactionsByAgent(agent.id, limit);
      return reply.send({ agentId: agent.id, transactions: txs });
    }
  );

  // capital ledger
  app.get<{ Params: { id: string } }>("/agents/:id/capital", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });

    try {
      const connection = getConnection();
      const portfolioUSD = await getPortfolioUSD(agent.public_key, connection);
      const ledger = computeLedgerState(agent.id, portfolioUSD);
      return reply.send(ledger);
    } catch (e) {
      return reply.status(500).send({ error: (e as Error).message });
    }
  });

  app.get<{ Params: { id: string } }>("/agents/:id/capital/export", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });

    const csv = exportAccountingCSV(agent.id);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="agent-${agent.id}-accounting.csv"`);
    return reply.send(csv);
  });

  app.post<{ Params: { id: string } }>(
    "/agents/:id/funding",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      const body = FundingEventSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
      }

      insertCapitalEvent({
        id: uuidv4(),
        agent_id: agent.id,
        event_type: "funding",
        amount_sol: body.data.amountSol,
        amount_usd: body.data.amountUsd,
        source_note: body.data.sourceNote ?? null,
        created_at: new Date().toISOString(),
      });

      return reply.status(201).send({ agentId: agent.id, recorded: true });
    }
  );

  // policy versions
  app.get<{ Params: { id: string } }>("/agents/:id/policy-versions", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });
    return reply.send({ agentId: agent.id, versions: getPolicyVersions(agent.id) });
  });

  // pending transactions (hitl)
  app.get<{ Params: { id: string } }>("/agents/:id/pending", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });
    return reply.send({ agentId: agent.id, pending: listPendingTx(agent.id) });
  });

  app.patch<{ Params: { id: string; txId: string } }>(
    "/agents/:id/pending/:txId/approve",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      try {
        const result = approvePendingTx(request.params.txId, agent.id);
        return reply.send(result);
      } catch (e) {
        return reply.status(400).send({ error: (e as Error).message });
      }
    }
  );

  app.patch<{ Params: { id: string; txId: string } }>(
    "/agents/:id/pending/:txId/reject",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });

      try {
        const result = rejectPendingTx(request.params.txId, agent.id);
        return reply.send(result);
      } catch (e) {
        return reply.status(400).send({ error: (e as Error).message });
      }
    }
  );

  // audit trail
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/agents/:id/audit",
    async (request, reply) => {
      const agent = getAgentById(request.params.id);
      if (!agent) return reply.status(404).send({ error: "agent not found" });
      const limit = parseInt(request.query.limit ?? "50", 10);
      return reply.send({ agentId: agent.id, audit: getAuditLog(agent.id, limit) });
    }
  );

  app.get<{ Params: { id: string } }>("/agents/:id/audit/export", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });

    const json = exportAuditJSON(agent.id);
    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="agent-${agent.id}-audit.json"`);
    return reply.send(json);
  });
}
