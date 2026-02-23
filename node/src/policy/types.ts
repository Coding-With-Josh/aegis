export interface AgentPolicy {
  allowedIntents: string[];
  allowedMints: string[];
  maxTxAmountSOL: number;
  dailySpendLimitSOL: number;
  maxSlippageBps: number;
  requireSimulation: boolean;
  cooldownMs?: number;
}

export interface PolicyViolation {
  code: string;
  message: string;
}
