import type { IntentHandler } from "./base.js";
import { TransferIntentHandler } from "./transfer.js";
import { SwapIntentHandler } from "./swap.js";
import { StakeIntentHandler } from "./stake.js";
import { LendIntentHandler } from "./lend.js";
import { FlashIntentHandler } from "./flash.js";
import { CpiIntentHandler } from "./cpi.js";

type HandlerFactory = () => IntentHandler;

const REGISTRY: Record<string, HandlerFactory> = {
  transfer: () => new TransferIntentHandler(),
  swap: () => new SwapIntentHandler(),
  stake: () => new StakeIntentHandler(),
  lend: () => new LendIntentHandler(),
  flash: () => new FlashIntentHandler(),
  cpi: () => new CpiIntentHandler(),
};

export function getIntentHandler(intentType: string): IntentHandler {
  const factory = REGISTRY[intentType];
  if (!factory) {
    const known = Object.keys(REGISTRY).join(", ");
    throw new Error(`unknown intent type "${intentType}". known types: ${known}`);
  }
  return factory();
}

export function getKnownIntentTypes(): string[] {
  return Object.keys(REGISTRY);
}
