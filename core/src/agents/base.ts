import { PublicKey } from "@solana/web3.js";
import type { Intent } from "./intents.js";

export interface AgentContext {
  agentId: string;
  peerPubkeys?: Map<string, PublicKey>;
  step: number;
  testProgramId?: PublicKey;
}

export interface AgentRunResult {
  intents: Intent[];
  reason: string;
}

export abstract class BaseAgent {
  abstract readonly name: string;

  abstract intents(ctx: AgentContext): Intent[];

  protected reason(ctx: AgentContext, intents: Intent[]): string {
    if (intents.length === 0) return "no action this step";
    return intents.map((i) => {
      if (i.type === "transfer") return `transfer ${i.lamports} lamports to ${i.to.toBase58().slice(0, 8)}...`;
      if (i.type === "transferSpl") return `transfer ${i.amount} tokens to ${i.to.toBase58().slice(0, 8)}...`;
      if (i.type === "callProgram") return `call program ${i.programId.toBase58().slice(0, 8)}...`;
      return "unknown intent";
    }).join("; ");
  }

  run(ctx: AgentContext): AgentRunResult {
    const intents = this.intents(ctx);
    return { intents, reason: this.reason(ctx, intents) };
  }
}
