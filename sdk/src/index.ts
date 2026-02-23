export { AegisClient, AegisError } from "./client.js";
export type {
  AegisClientOptions,
  AgentPolicy,
  AgentInfo,
  AgentBalance,
  AgentTransaction,
  CreateAgentResult,
  ExecutionReceipt,
  Intent,
  PolicyViolation,
} from "./types.js";
export {
  transfer,
  swap,
  stake,
  lend,
  flash,
  cpi,
} from "./intents.js";
export type {
  TransferParams,
  SwapParams,
  StakeParams,
  LendParams,
  FlashParams,
  CpiParams,
  FlashInstruction,
  FlashAccountMeta,
} from "./intents.js";
