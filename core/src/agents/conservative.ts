import { PublicKey } from "@solana/web3.js";
import type { Intent } from "./intents.js";
import { buildIncrementIntent, AEGIS_TEST_PROGRAM_ID } from "../test-program-client.js";
import { BaseAgent, type AgentContext } from "./base.js";

export interface ConservativeContext extends AgentContext {
  testProgramId?: PublicKey;
}

export function conservativeIntents(ctx: ConservativeContext): Intent[] {
  if (!ctx.testProgramId && !AEGIS_TEST_PROGRAM_ID) {
    return [];
  }
  return [buildIncrementIntent(ctx.testProgramId ?? AEGIS_TEST_PROGRAM_ID)];
}

export class ConservativeAgentClass extends BaseAgent {
  readonly name = "ConservativeAgent";

  intents(ctx: AgentContext): Intent[] {
    return conservativeIntents(ctx as ConservativeContext);
  }
}
