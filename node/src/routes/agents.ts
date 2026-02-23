import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createAgent } from "../agents/create.js";
import { getAgentById, getAllAgents, getTransactionsByAgent } from "../db.js";
import { getDailySpend } from "../spend/tracker.js";
import type { AgentPolicy } from "../policy/types.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";

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
    })
    .optional(),
});

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agents", async (_request, reply) => {
    const agents = getAllAgents();
    return reply.send({
      agents: agents.map((a) => ({
        id: a.id,
        publicKey: a.public_key,
        status: a.status,
        createdAt: a.created_at,
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
    return reply.send({
      agentId: agent.id,
      publicKey: agent.public_key,
      status: agent.status,
      createdAt: agent.created_at,
      policy,
    });
  });

  app.get<{ Params: { id: string } }>("/agents/:id/balance", async (request, reply) => {
    const agent = getAgentById(request.params.id);
    if (!agent) return reply.status(404).send({ error: "agent not found" });

    try {
      const connection = new Connection(RPC);
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
        const connection = new Connection(RPC);
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
}
