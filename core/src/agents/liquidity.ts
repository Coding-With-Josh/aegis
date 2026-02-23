import { PublicKey } from "@solana/web3.js";
import type { Intent, TransferIntent } from "./intents.js";
import { buildIncrementIntent } from "../test-program-client.js";
import { BaseAgent, type AgentContext } from "./base.js";

const LAMPORTS_PER_ACTION = 3e6;

export interface LiquidityContext extends AgentContext {
  peerPubkeys: Map<string, PublicKey>;
}

export function liquidityIntents(ctx: LiquidityContext): Intent[] {
  const intents: Intent[] = [];
  if (ctx.step % 2 === 0) {
    const peers = Array.from(ctx.peerPubkeys.entries()).filter(([id]) => id !== ctx.agentId);
    if (peers.length > 0) {
      const [_, to] = peers[ctx.step % peers.length];
      intents.push({ type: "transfer", to, lamports: LAMPORTS_PER_ACTION } as TransferIntent);
    }
  } else {
    if (ctx.testProgramId || process.env.AEGIS_TEST_PROGRAM_ID) {
      intents.push(buildIncrementIntent(ctx.testProgramId));
    }
  }
  return intents;
}

export class LiquidityAgentClass extends BaseAgent {
  readonly name = "LiquidityAgent";

  intents(ctx: AgentContext): Intent[] {
    return liquidityIntents(ctx as LiquidityContext);
  }
}
