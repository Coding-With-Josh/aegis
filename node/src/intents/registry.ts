import type { IntentHandler } from "./base.js";
import { TransferIntentHandler } from "./transfer.js";
import { SwapIntentHandler } from "./swap.js";

type HandlerFactory = () => IntentHandler;

const REGISTRY: Record<string, HandlerFactory> = {
  transfer: () => new TransferIntentHandler(),
  swap: () => new SwapIntentHandler(),
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
