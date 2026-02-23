import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../auth.js";
import { fetchAgent } from "../agents/fetch.js";
import { getIntentHandler } from "../intents/registry.js";
import { PolicyEngine, PolicyError } from "../policy/engine.js";
import { simulateTransaction } from "../execution/simulate.js";
import { executeTransaction } from "../execution/execute.js";
import { insertTransaction, updateReputation } from "../db.js";
import { getConnection } from "../rpc.js";
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
          });
          updateReputation(agentId, -0.05);
          return reply.status(403).send({ error: "policy violation", violations: e.violations });
        }
        return reply.status(500).send({ error: (e as Error).message });
      }

      const connection = getConnection();

      let tx;
      try {
        tx = await handler.buildTransaction(agent, connection);
      } catch (e) {
        return reply.status(500).send({ error: `transaction build failed: ${(e as Error).message}` });
      }

      let simulation = null;
      if (policy.requireSimulation) {
        try {
          simulation = await simulateTransaction(connection, tx, agent);
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
            });
            updateReputation(agentId, -0.02);
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
            });
            updateReputation(agentId, -0.02);
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

      try {
        const receipt = await executeTransaction(connection, tx, agent, {
          intentType: intent.type,
          reasoning,
          amountSOL: impact.amountSOL,
          mint: impact.mint,
          simulation,
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
        });
        return reply.status(500).send({ error: `execution failed: ${(e as Error).message}` });
      }
    }
  );
}
