import type { Intent } from "./intents.js";
import { buildTradeIntent, AEGIS_TEST_PROGRAM_ID } from "../test-program-client.js";
import { BaseAgent, type AgentContext } from "./base.js";

const SCRIPTED_TRADE_AMOUNT = 100;

export interface DeFiTraderContext extends AgentContext {
  testProgramId?: import("@solana/web3.js").PublicKey;
}

export function defiTraderIntents(ctx: DeFiTraderContext): Intent[] {
  if (!ctx.testProgramId && !AEGIS_TEST_PROGRAM_ID) return [];
  const amount = SCRIPTED_TRADE_AMOUNT + (ctx.step % 50);
  return [buildTradeIntent(amount, ctx.testProgramId ?? AEGIS_TEST_PROGRAM_ID)];
}

export class DeFiTraderAgentClass extends BaseAgent {
  readonly name = "DeFiTraderAgent";

  intents(ctx: AgentContext): Intent[] {
    return defiTraderIntents(ctx as DeFiTraderContext);
  }
}
