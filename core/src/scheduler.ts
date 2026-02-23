import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadMetadata } from "./wallet-factory/metadata.js";
import { keypairExists } from "./keystore/index.js";
import { executeIntent, defaultPolicy, buildDefaultAllowedPrograms } from "./execution/index.js";
import { AEGIS_TEST_PROGRAM_ID, tradesPda } from "./test-program-client.js";
import { appendDecision } from "./memory/store.js";
import { buildLLMRegistry } from "./agents/llm/registry.js";
import { logInfo, logWarn, logError } from "./logger.js";
import type { Intent } from "./agents/intents.js";
import type { BaseLLMAgent } from "./agents/llm/registry.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PASSPHRASE = process.env.KEYSTORE_PASSPHRASE ?? "";
const META_DIR = ".aegis/meta";
const KEYSTORE_DIR = ".aegis/keystore";
const MEMORY_DIR = ".aegis/memory";
const DEFAULT_INTERVAL_MS = 30_000;

export interface SchedulerOptions {
  intervalMs?: number;
  once?: boolean;
}

export async function startScheduler(opts: SchedulerOptions = {}): Promise<void> {
  if (!PASSPHRASE) {
    logError("KEYSTORE_PASSPHRASE not set, scheduler cannot sign transactions");
    process.exit(1);
  }

  const intervalMs = opts.intervalMs
    ?? parseInt(process.env.LLM_INTERVAL_MS ?? String(DEFAULT_INTERVAL_MS), 10);

  const c = new Connection(RPC);
  const meta = await loadMetadata(META_DIR);

  if (meta.length === 0) {
    logError("no agents found, run: npm run create-wallets first");
    process.exit(1);
  }

  const agentIds = meta.map((m) => m.agentId);
  const registry = buildLLMRegistry(agentIds, MEMORY_DIR);

  logInfo("scheduler started", {
    agents: registry.map((e) => `${e.agentId}(${e.agent.name})`),
    intervalMs,
  });

  let step = 0;
  let running = true;

  process.on("SIGINT", () => {
    logInfo("shutting down");
    running = false;
    process.exit(0);
  });

  const runAgent = async (
    agentId: string,
    agent: BaseLLMAgent,
    currentStep: number,
    peerAddresses: string[],
    basePolicy: ReturnType<typeof defaultPolicy>,
    programReady: boolean,
  ) => {
    if (!keypairExists(agentId, KEYSTORE_DIR)) {
      logWarn("keystore missing, skipping", { agentId });
      return;
    }

    const agentMeta = meta.find((m) => m.agentId === agentId);
    if (!agentMeta) return;

    let balanceLamports = 0;
    try {
      balanceLamports = await c.getBalance(new PublicKey(agentMeta.publicKey));
    } catch {
      logWarn("balance fetch failed", { agentId });
    }

    const peers = peerAddresses.filter((a) => a !== agentMeta.publicKey);
    agent.updateContext(balanceLamports, peers, programReady);

    let intents: Intent[] = [];
    let intentRequest = null;
    let reason = "";

    try {
      const result = await agent.runAsync({ agentId, step: currentStep, testProgramId: AEGIS_TEST_PROGRAM_ID ?? undefined });
      intents = result.intents;
      reason = result.reason;
      intentRequest = result.intentRequest;
    } catch (e) {
      const msg = (e as Error).message;
      logError("agent run failed", { agentId, error: msg });
      await appendDecision({
        ts: new Date().toISOString(),
        agentId,
        provider: agent.provider.name,
        action: "hold",
        reasoning: `provider error: ${msg}`,
        confidence: 0,
        rejected: false,
        balanceLamports,
      }, MEMORY_DIR);
      return;
    }

    if (intents.length === 0) {
      await appendDecision({
        ts: new Date().toISOString(),
        agentId,
        provider: agent.provider.name,
        action: intentRequest?.action ?? "hold",
        reasoning: intentRequest?.reasoning ?? reason,
        confidence: intentRequest?.confidence ?? 0,
        rejected: false,
        balanceLamports,
      }, MEMORY_DIR);
      return;
    }

    const agentPolicy = {
      ...basePolicy,
      maxTransferLamports: Math.floor(balanceLamports * agent.riskProfile.maxPct),
    };

    for (const intent of intents) {
      try {
        const sig = await executeIntent(c, agentId, intent, PASSPHRASE, {
          keystoreDir: KEYSTORE_DIR,
          policy: agentPolicy,
        });
        logInfo("tx confirmed", { agentId, sig, action: intent.type, provider: agent.provider.name });
        await appendDecision({
          ts: new Date().toISOString(),
          agentId,
          provider: agent.provider.name,
          action: intent.type,
          reasoning: intentRequest?.reasoning ?? reason,
          confidence: intentRequest?.confidence ?? 1,
          sig,
          rejected: false,
          balanceLamports,
        }, MEMORY_DIR);
      } catch (e) {
        const msg = (e as Error).message;
        logWarn("tx rejected or failed", { agentId, intent: intent.type, reason: msg });
        await appendDecision({
          ts: new Date().toISOString(),
          agentId,
          provider: agent.provider.name,
          action: intent.type,
          reasoning: intentRequest?.reasoning ?? reason,
          confidence: intentRequest?.confidence ?? 0,
          rejected: true,
          rejectionReason: msg,
          balanceLamports,
        }, MEMORY_DIR);
      }
    }
  };

  const tick = async () => {
    if (!running) return;
    logInfo("tick", { step, agents: registry.length });

    const peerAddresses = meta.map((m) => m.publicKey);
    const allowedRecipients = meta.map((m) => new PublicKey(m.publicKey));
    const allowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
    const basePolicy = defaultPolicy(allowedRecipients, allowedPrograms);

    let programReady = false;
    if (AEGIS_TEST_PROGRAM_ID) {
      try {
        const pdaInfo = await c.getAccountInfo(tradesPda(AEGIS_TEST_PROGRAM_ID));
        programReady = pdaInfo !== null;
      } catch {
        /* rpc hiccup */
      }
    }

    await Promise.all(
      registry.map(({ agentId, agent }) =>
        runAgent(agentId, agent, step, peerAddresses, basePolicy, programReady)
      )
    );

    step++;
  };

  await tick();

  if (!opts.once) {
    const timer = setInterval(async () => {
      if (!running) {
        clearInterval(timer);
        return;
      }
      await tick();
    }, intervalMs);
  }
}
