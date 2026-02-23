import { PublicKey } from "@solana/web3.js";
import { BaseAgent, type AgentContext, type AgentRunResult } from "../base.js";
import type { Intent } from "../intents.js";
import type { LLMProvider } from "../../llm/provider.js";
import type { RiskProfile } from "../../llm/prompt.js";
import { buildSystemPrompt, buildUserPrompt, type PromptContext } from "../../llm/prompt.js";
import { parseWithRetry, type IntentRequest } from "../../llm/schema.js";
import { readHistory } from "../../memory/store.js";
import { logInfo, logWarn, logDebug } from "../../logger.js";
import { AEGIS_TEST_PROGRAM_ID, buildTradeIntent } from "../../test-program-client.js";

// 0.01 SOL floor so the wallet can always cover fees
const MIN_BALANCE_LAMPORTS = 10_000_000;

export interface LLMAgentOpts {
  agentId: string;
  provider: LLMProvider;
  riskProfile: RiskProfile;
  personality: string;
  balanceLamports?: number;
  peerAddresses?: string[];
  memoryDir?: string;
}

export abstract class BaseLLMAgent extends BaseAgent {
  readonly provider: LLMProvider;
  readonly riskProfile: RiskProfile;
  protected personality: string;
  protected agentId: string;
  protected balanceLamports: number;
  protected peerAddresses: string[];
  protected memoryDir: string;
  protected programReady: boolean;

  lastIntentRequest: IntentRequest | null = null;

  constructor(opts: LLMAgentOpts) {
    super();
    this.agentId = opts.agentId;
    this.provider = opts.provider;
    this.riskProfile = opts.riskProfile;
    this.personality = opts.personality;
    this.balanceLamports = opts.balanceLamports ?? 0;
    this.peerAddresses = opts.peerAddresses ?? [];
    this.memoryDir = opts.memoryDir ?? ".aegis/memory";
    this.programReady = false;
  }

  updateContext(balanceLamports: number, peerAddresses: string[], programReady = false): void {
    this.balanceLamports = balanceLamports;
    this.peerAddresses = peerAddresses;
    this.programReady = programReady;
  }

  intents(_ctx: AgentContext): Intent[] {
    return [];
  }

  async runAsync(ctx: AgentContext): Promise<AgentRunResult & { intentRequest: IntentRequest }> {
    const history = await readHistory(this.agentId, 3, this.memoryDir);
    const recentHistory = history.map((h) => ({
      action: h.action,
      reasoning: h.reasoning,
      ts: h.ts,
    }));

    const promptCtx: PromptContext = {
      agentId: this.agentId,
      balanceLamports: this.balanceLamports,
      peerAddresses: this.peerAddresses,
      step: ctx.step,
      recentHistory,
      riskProfile: this.riskProfile,
      testProgramId: AEGIS_TEST_PROGRAM_ID?.toBase58(),
      programReady: this.programReady,
    };

    const systemPrompt = buildSystemPrompt(this.name, this.personality, this.riskProfile);
    const userPrompt = buildUserPrompt(promptCtx);

    logDebug("llm call", { agentId: this.agentId, provider: this.provider.name, step: ctx.step });

    const intentRequest = await parseWithRetry(this.provider, systemPrompt, userPrompt);
    this.lastIntentRequest = intentRequest;

    logInfo("llm decision", {
      agentId: this.agentId,
      provider: this.provider.name,
      action: intentRequest.action,
      confidence: intentRequest.confidence,
      reasoning: intentRequest.reasoning.slice(0, 100),
    });

    const intents = this.mapToIntents(intentRequest);
    const reason = `[${this.provider.name}] ${intentRequest.reasoning}`;
    return { intents, reason, intentRequest };
  }

  protected mapToIntents(req: IntentRequest): Intent[] {
    if (req.action === "hold") return [];

    if (!this.riskProfile.allowedActions.includes(req.action)) {
      logWarn("blocked: action not in allowlist", {
        agentId: this.agentId,
        action: req.action,
        allowed: this.riskProfile.allowedActions,
      });
      return [];
    }

    if (req.action === "transfer") {
      if (!req.to || !req.lamports) return [];

      if (this.balanceLamports <= MIN_BALANCE_LAMPORTS) {
        logWarn("blocked: balance at floor, refusing transfer", {
          agentId: this.agentId,
          balance: this.balanceLamports,
          floor: MIN_BALANCE_LAMPORTS,
        });
        return [];
      }

      const maxLamports = Math.floor(this.balanceLamports * this.riskProfile.maxPct);
      if (req.lamports > maxLamports) {
        logWarn("blocked: over risk cap", {
          agentId: this.agentId,
          requested: req.lamports,
          max: maxLamports,
        });
        return [];
      }

      if (!this.peerAddresses.includes(req.to)) {
        logWarn("blocked: recipient not in peer list", { agentId: this.agentId, to: req.to.slice(0, 8) });
        return [];
      }

      try {
        return [{ type: "transfer", to: new PublicKey(req.to), lamports: req.lamports }];
      } catch {
        logWarn("blocked: bad pubkey", { agentId: this.agentId });
        return [];
      }
    }

    if (req.action === "callProgram") {
      if (!AEGIS_TEST_PROGRAM_ID) {
        logWarn("callProgram skipped, AEGIS_TEST_PROGRAM_ID not set", { agentId: this.agentId });
        return [];
      }
      if (!this.programReady) {
        logWarn("callProgram skipped, program state not initialized (run: npm run init-trades)", { agentId: this.agentId });
        return [];
      }
      const amount = req.lamports ?? 50;
      return [buildTradeIntent(amount, AEGIS_TEST_PROGRAM_ID)];
    }

    if (req.action === "transferSpl") {
      if (!req.to || !req.mint || !req.amount) return [];
      if (!this.peerAddresses.includes(req.to)) {
        logWarn("blocked: spl recipient not in peer list", { agentId: this.agentId });
        return [];
      }
      try {
        return [{ type: "transferSpl", mint: new PublicKey(req.mint), to: new PublicKey(req.to), amount: req.amount }];
      } catch {
        return [];
      }
    }

    return [];
  }
}
