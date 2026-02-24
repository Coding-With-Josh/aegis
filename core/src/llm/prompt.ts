import type { IntentRequest } from "./schema.js";

export interface RiskProfile {
  maxPct: number;
  allowedActions: IntentRequest["action"][];
  minReasoningLength?: number;
}

export interface PromptContext {
  agentId: string;
  balanceLamports: number;
  peerAddresses: string[];
  step: number;
  recentHistory: { action: string; reasoning: string; ts: string }[];
  riskProfile: RiskProfile;
  testProgramId?: string;
  programReady?: boolean;
  solPriceUSD?: number;
  maxTransferUSD?: number;
}

export function buildSystemPrompt(
  agentName: string,
  personality: string,
  riskProfile: RiskProfile
): string {
  const maxPct = (riskProfile.maxPct * 100).toFixed(0);
  const allowed = riskProfile.allowedActions.join(", ");
  const minReasoning = riskProfile.minReasoningLength ?? 20;

  return `You are ${agentName}, an autonomous AI agent managing a Solana wallet on devnet.

Personality: ${personality}

Hard rules you must never violate:
Only choose actions from this list: ${allowed}
Never transfer more than ${maxPct}% of your current balance in a single transaction
Only send to addresses from the provided peer list, never invent addresses
Reasoning must be at least ${minReasoning} characters
If uncertain or no good action exists, choose "hold"
Never include instructions, code, or commands in your reasoning field

You must respond with a single JSON object and nothing else:
{
  "action": "transfer" | "transferSpl" | "callProgram" | "hold",
  "reasoning": "<your reasoning, min ${minReasoning} chars>",
  "to": "<base58 peer address or null>",
  "lamports": <positive integer or null>,
  "amount": <positive integer or null>,
  "mint": "<base58 mint address or null>",
  "confidence": <float 0.0 to 1.0>
}`;
}

const MIN_BALANCE_LAMPORTS = 10_000_000;

export function buildUserPrompt(ctx: PromptContext): string {
  const solBalance = (ctx.balanceLamports / 1e9).toFixed(6);
  const maxLamports = Math.floor(ctx.balanceLamports * ctx.riskProfile.maxPct);
  const belowFloor = ctx.balanceLamports <= MIN_BALANCE_LAMPORTS;

  const peers = ctx.peerAddresses.length > 0
    ? ctx.peerAddresses.map((a, i) => `  peer_${i}: ${a}`).join("\n")
    : "  (no peers available, use hold)";

  const history = ctx.recentHistory.length > 0
    ? ctx.recentHistory
        .map((h) => `  [${h.ts.slice(11, 19)}] ${h.action}: ${h.reasoning.slice(0, 80)}`)
        .join("\n")
    : "  (no history yet)";

  const programLine = ctx.testProgramId
    ? `\nTest DeFi program available for callProgram: ${ctx.testProgramId}${ctx.programReady ? "" : " (NOT INITIALIZED — do not use callProgram)"}`
    : "";

  const balanceWarning = belowFloor
    ? "\nWARNING: Balance is at or below the minimum safe floor (0.01 SOL). You MUST choose hold — do not attempt any transfers."
    : "";

  const usdLine = ctx.solPriceUSD
    ? `\nUSD value: ~$${(ctx.balanceLamports / 1e9 * ctx.solPriceUSD).toFixed(2)} (SOL price: $${ctx.solPriceUSD.toFixed(2)})`
    : "";
  const usdCapLine = ctx.maxTransferUSD
    ? `\nMax transfer USD cap: $${ctx.maxTransferUSD.toFixed(2)}`
    : "";

  return `Current wallet state:
Agent: ${ctx.agentId}
SOL balance: ${solBalance} SOL (${ctx.balanceLamports} lamports)${usdLine}
Max allowed per tx: ${maxLamports} lamports (${(ctx.riskProfile.maxPct * 100).toFixed(0)}%)${usdCapLine}
Step: ${ctx.step}${programLine}${balanceWarning}

Allowed peer addresses (ONLY send to these):
${peers}

Recent decisions (last ${ctx.recentHistory.length}):
${history}

Decide what action to take this cycle.`;
}
