import { PublicKey } from "@solana/web3.js";
import type { Intent, TransferIntent } from "./intents.js";
import { BaseAgent, type AgentContext } from "./base.js";

const LAMPORTS_PER_ACTION = 5e6;

export interface TraderContext extends AgentContext {
  peerPubkeys: Map<string, PublicKey>;
}

export function traderIntents(ctx: TraderContext): Intent[] {
  const intents: Intent[] = [];
  const peers = Array.from(ctx.peerPubkeys.entries()).filter(([id]) => id !== ctx.agentId);
  if (peers.length === 0) return intents;
  const target = peers[ctx.step % peers.length];
  const to = target[1];
  intents.push({
    type: "transfer",
    to,
    lamports: LAMPORTS_PER_ACTION,
  } as TransferIntent);
  return intents;
}

export class TraderAgentClass extends BaseAgent {
  readonly name = "TraderAgent";

  intents(ctx: AgentContext): Intent[] {
    return traderIntents(ctx as TraderContext);
  }
}
