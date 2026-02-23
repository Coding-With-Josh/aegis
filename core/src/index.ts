export { createWallets, airdropForAgent, airdropAll } from "./wallet-factory/index.js";
export { saveKeypair, getKeypair, keypairExists } from "./keystore/index.js";
export type { TransferIntent, TransferSPLIntent, CallProgramIntent, Intent } from "./agents/intents.js";
export { saveSplMint, loadSplMint } from "./spl-mint.js";
export {
  executeIntent,
  validateIntent,
  defaultPolicy,
  buildDefaultAllowedPrograms,
} from "./execution/index.js";
export type { ExecuteOptions, ExecutionPolicy } from "./execution/index.js";
export {
  TraderAgent, LiquidityAgent, ConservativeAgent, DeFiTraderAgent,
  TraderAgentClass, LiquidityAgentClass, ConservativeAgentClass, DeFiTraderAgentClass,
  BaseAgent, AGENT_CLASSES,
  peerPubkeysFromMeta,
  loadAgentConfig, saveAgentConfig,
} from "./agents/index.js";
export type { AgentContext, AgentRunResult, AgentConfig, AgentStrategy } from "./agents/index.js";
export { buildIncrementIntent, buildInitCounterIntent, buildTradeIntent, buildInitTradesIntent, counterPda, tradesPda, AEGIS_TEST_PROGRAM_ID } from "./test-program-client.js";
export { log, logInfo, logWarn, logError, logDebug } from "./logger.js";
