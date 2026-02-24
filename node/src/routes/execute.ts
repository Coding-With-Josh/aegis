import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../auth.js";
import { fetchAgent } from "../agents/fetch.js";
import { getIntentHandler } from "../intents/registry.js";
import { PolicyEngine, PolicyError } from "../policy/engine.js";
import { hashPolicy, hashIntent } from "../policy/hash.js";
import { simulateTransaction } from "../execution/simulate.js";
import { executeTransaction } from "../execution/execute.js";
import { insertTransaction, updateReputation, getSpend, insertPolicyVersion, getLatestPolicyVersion } from "../db.js";
import { getConnection } from "../rpc.js";
import { toUSD, getPortfolioUSD } from "../usd/valuation.js";
import { USDPolicyEngine, USDPolicyError } from "../usd/policy.js";
import { triggerFundingAlert } from "../fiat/funding.js";
import { storePendingTx } from "../hitl/approval.js";
import { writeAuditArtifact, makeAuditId } from "../audit/trail.js";
import { upsertSpend, updatePeakPortfolioUSD } from "../db.js";
import { utcDate } from "../policy/engine.js";
import type { USDPolicy } from "../policy/types.js";
import { v4 as uuidv4 } from "uuid";

const ExecuteBodySchema = z.object({
  intent: z.object({
    type: z.string(),
    params: z.record(z.unknown()),
  }),
  reasoning: z.string().optional().default(""),
});

export async function executeRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>(
    "/agents/:id/execute",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const body = ExecuteBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues.map((i) => i.message).join(", ") });
      }

      const { intent, reasoning } = body.data;
      const agentId = request.params.id;

      let agentData: ReturnType<typeof fetchAgent>;
      try {
        agentData = fetchAgent(agentId);
      } catch (e) {
        return reply.status(404).send({ error: (e as Error).message });
      }

      const { row: agent, policy } = agentData;

      if (agent.status !== "active") {
        return reply.status(403).send({ error: `agent is ${agent.status} and cannot execute intents` });
      }

      const policyEngine = new PolicyEngine(agentId, policy);
      const policyHash = hashPolicy(policy);
      const intentHash = hashIntent(intent);

      // register policy version if new
      const latestVersion = getLatestPolicyVersion(agentId);
      const policyVersion = latestVersion + 1;
      insertPolicyVersion({
        agent_id: agentId,
        version: policyVersion,
        policy_hash: policyHash,
        policy_json: JSON.stringify(policy),
        created_at: new Date().toISOString(),
      });

      const auditId = makeAuditId();
      const connection = getConnection();

      let handler;
      try {
        handler = getIntentHandler(intent.type);
      } catch (e) {
        return reply.status(400).send({ error: (e as Error).message });
      }

      try {
        handler.validate(intent.params);
      } catch (e) {
        return reply.status(400).send({ error: (e as Error).message });
      }

      const impact = handler.estimateImpact(intent.params);

      try {
        policyEngine.enforce([
          policyEngine.checkIntentType(intent.type),
          policyEngine.checkMint(impact.mint),
          policyEngine.checkTxAmount(impact.amountSOL),
          policyEngine.checkDailySpend(impact.amountSOL),
          policyEngine.checkCooldown(agent.last_activity_at),
          policyEngine.checkRiskScore(impact.riskScore),
          ...(intent.type === "swap"
            ? [policyEngine.checkSlippage((intent.params as { slippageBps?: number }).slippageBps ?? 50)]
            : []),
        ]);
      } catch (e) {
        if (e instanceof PolicyError) {
          insertTransaction({
            id: uuidv4(),
            agent_id: agentId,
            intent_type: intent.type,
            reasoning,
            signature: null,
            slot: null,
            amount: impact.amountSOL,
            token_mint: impact.mint,
            status: "rejected_policy",
            created_at: new Date().toISOString(),
            policy_hash: policyHash,
            intent_hash: intentHash,
            usd_value: null,
          });
          updateReputation(agentId, -0.05);
          writeAuditArtifact({
            id: auditId,
            agentId,
            intent,
            intentHash,
            policyHash,
            usdRiskCheck: null,
            simulationResult: null,
            approvalState: "rejected",
            finalTxSignature: null,
            timestamp: new Date().toISOString(),
          });
          return reply.status(403).send({ error: "policy violation", violations: e.violations });
        }
        return reply.status(500).send({ error: (e as Error).message });
      }

      // usd risk checks
      const usdValue = await toUSD(impact.amountSOL, impact.mint);
      const portfolioUSD = await getPortfolioUSD(agent.public_key, connection);
      const today = utcDate();
      const spend = getSpend(agentId, today);

      let usdRiskCheck: { usdValue: number; passed: boolean; violations: string[] } | null = null;

      if (agent.usd_policy_json) {
        const usdPolicy = JSON.parse(agent.usd_policy_json) as USDPolicy;
        const usdEngine = new USDPolicyEngine(agentId, usdPolicy);

        const peakPortfolioUSD = spend.peak_portfolio_usd ?? 0;
        const usdViolations: string[] = [];

        try {
          usdEngine.enforce([
            usdEngine.checkTxUSD(usdValue),
            usdEngine.checkDailyUSD(usdValue),
            usdEngine.checkPortfolioExposure(usdValue, portfolioUSD),
            usdEngine.checkDrawdown(portfolioUSD, peakPortfolioUSD),
          ]);
          usdRiskCheck = { usdValue, passed: true, violations: [] };
        } catch (e) {
          if (e instanceof USDPolicyError) {
            usdViolations.push(...e.violations.map((v) => v.message));
            usdRiskCheck = { usdValue, passed: false, violations: usdViolations };
            insertTransaction({
              id: uuidv4(),
              agent_id: agentId,
              intent_type: intent.type,
              reasoning,
              signature: null,
              slot: null,
              amount: impact.amountSOL,
              token_mint: impact.mint,
              status: "rejected_policy",
              created_at: new Date().toISOString(),
              policy_hash: policyHash,
              intent_hash: intentHash,
              usd_value: usdValue,
            });
            updateReputation(agentId, -0.05);
            writeAuditArtifact({
              id: auditId,
              agentId,
              intent,
              intentHash,
              policyHash,
              usdRiskCheck,
              simulationResult: null,
              approvalState: "rejected",
              finalTxSignature: null,
              timestamp: new Date().toISOString(),
            });
            return reply.status(403).send({ error: "usd policy violation", violations: e.violations });
          }
          return reply.status(500).send({ error: (e as Error).message });
        }
      }

      // low balance fiat alert (non-blocking)
      const balanceSol = portfolioUSD > 0 ? portfolioUSD : 0;
      await triggerFundingAlert(agent, balanceSol);

      // update peak portfolio usd
      updatePeakPortfolioUSD(agentId, today, portfolioUSD);

      let tx;
      try {
        tx = await handler.buildTransaction(agent, connection);
      } catch (e) {
        return reply.status(500).send({ error: `transaction build failed: ${(e as Error).message}` });
      }

      let simulation = null;
      if (policy.requireSimulation) {
        try {
          simulation = await simulateTransaction(connection, tx, agent, {
            expectedAmountSOL: impact.amountSOL,
            expectedMint: impact.mint,
            usdImpactEstimate: usdValue,
          });

          if (!simulation.success) {
            insertTransaction({
              id: uuidv4(),
              agent_id: agentId,
              intent_type: intent.type,
              reasoning,
              signature: null,
              slot: null,
              amount: impact.amountSOL,
              token_mint: impact.mint,
              status: "rejected_simulation",
              created_at: new Date().toISOString(),
              policy_hash: policyHash,
              intent_hash: intentHash,
              usd_value: usdValue,
            });
            updateReputation(agentId, -0.02);
            writeAuditArtifact({
              id: auditId,
              agentId,
              intent,
              intentHash,
              policyHash,
              usdRiskCheck,
              simulationResult: simulation,
              approvalState: "rejected",
              finalTxSignature: null,
              timestamp: new Date().toISOString(),
            });
            return reply.status(400).send({
              error: "simulation failed",
              simulationError: simulation.error,
              logs: simulation.logs,
            });
          }

          if (simulation.riskyEffects) {
            insertTransaction({
              id: uuidv4(),
              agent_id: agentId,
              intent_type: intent.type,
              reasoning,
              signature: null,
              slot: null,
              amount: impact.amountSOL,
              token_mint: impact.mint,
              status: "rejected_simulation",
              created_at: new Date().toISOString(),
              policy_hash: policyHash,
              intent_hash: intentHash,
              usd_value: usdValue,
            });
            updateReputation(agentId, -0.02);
            writeAuditArtifact({
              id: auditId,
              agentId,
              intent,
              intentHash,
              policyHash,
              usdRiskCheck,
              simulationResult: simulation,
              approvalState: "rejected",
              finalTxSignature: null,
              timestamp: new Date().toISOString(),
            });
            return reply.status(400).send({
              error: "simulation flagged risky effects",
              riskReason: simulation.riskReason,
              logs: simulation.logs,
            });
          }
        } catch (e) {
          return reply.status(500).send({ error: `simulation error: ${(e as Error).message}` });
        }
      }

      // hitl gate — supervised agents queue for human approval
      if (agent.execution_mode === "supervised") {
        const pendingId = await storePendingTx({
          agentId,
          intent,
          intentHash,
          policyHash,
          reasoning,
          usdValue,
          simulation,
        });
        writeAuditArtifact({
          id: auditId,
          agentId,
          intent,
          intentHash,
          policyHash,
          usdRiskCheck,
          simulationResult: simulation,
          approvalState: "pending",
          finalTxSignature: null,
          timestamp: new Date().toISOString(),
        });
        return reply.status(202).send({ status: "awaiting_approval", pendingId });
      }

      // autonomous execution
      try {
        const receipt = await executeTransaction(connection, tx, agent, {
          intentType: intent.type,
          reasoning,
          amountSOL: impact.amountSOL,
          mint: impact.mint,
          simulation,
          policyHash,
          intentHash,
          usdValue,
        });

        upsertSpend(agentId, today, impact.amountSOL, 0, usdValue);

        writeAuditArtifact({
          id: auditId,
          agentId,
          intent,
          intentHash,
          policyHash,
          usdRiskCheck,
          simulationResult: simulation,
          approvalState: "auto",
          finalTxSignature: receipt.signature,
          timestamp: new Date().toISOString(),
        });

        return reply.send(receipt);
      } catch (e) {
        insertTransaction({
          id: uuidv4(),
          agent_id: agentId,
          intent_type: intent.type,
          reasoning,
          signature: null,
          slot: null,
          amount: impact.amountSOL,
          token_mint: impact.mint,
          status: "failed",
          created_at: new Date().toISOString(),
          policy_hash: policyHash,
          intent_hash: intentHash,
          usd_value: usdValue,
        });
        writeAuditArtifact({
          id: auditId,
          agentId,
          intent,
          intentHash,
          policyHash,
          usdRiskCheck,
          simulationResult: simulation,
          approvalState: "auto",
          finalTxSignature: null,
          timestamp: new Date().toISOString(),
        });
        return reply.status(500).send({ error: `execution failed: ${(e as Error).message}` });
      }
    }
  );
}
