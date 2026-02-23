import { PublicKey } from "@solana/web3.js";
import type { Intent } from "./intents.js";
import { traderIntents, type TraderContext, TraderAgentClass } from "./trader.js";
import { liquidityIntents, type LiquidityContext, LiquidityAgentClass } from "./liquidity.js";
import { conservativeIntents, type ConservativeContext, ConservativeAgentClass } from "./conservative.js";
import { defiTraderIntents, type DeFiTraderContext, DeFiTraderAgentClass } from "./defi-trader.js";

export type { Intent, TransferIntent, CallProgramIntent } from "./intents.js";
export { BaseAgent, type AgentContext, type AgentRunResult } from "./base.js";
export { TraderAgentClass, LiquidityAgentClass, ConservativeAgentClass, DeFiTraderAgentClass };
export type { AgentConfig, AgentStrategy } from "./config.js";
export { loadAgentConfig, saveAgentConfig } from "./config.js";

export function TraderAgent(ctx: TraderContext): Intent[] {
  return traderIntents(ctx);
}

export function LiquidityAgent(ctx: LiquidityContext): Intent[] {
  return liquidityIntents(ctx);
}

export function ConservativeAgent(ctx: ConservativeContext): Intent[] {
  return conservativeIntents(ctx);
}

export function DeFiTraderAgent(ctx: DeFiTraderContext): Intent[] {
  return defiTraderIntents(ctx);
}

export function peerPubkeysFromMeta(meta: { agentId: string; publicKey: string }[]): Map<string, PublicKey> {
  const m = new Map<string, PublicKey>();
  for (const { agentId, publicKey } of meta) {
    m.set(agentId, new PublicKey(publicKey));
  }
  return m;
}

// class-based agent registry keyed by strategy name
export const AGENT_CLASSES = {
  trader: TraderAgentClass,
  liquidity: LiquidityAgentClass,
  conservative: ConservativeAgentClass,
  defiTrader: DeFiTraderAgentClass,
} as const;
