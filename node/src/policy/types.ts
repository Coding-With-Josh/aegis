export interface AgentPolicy {
  allowedIntents: string[];
  allowedMints: string[];
  maxTxAmountSOL: number;
  dailySpendLimitSOL: number;
  maxSlippageBps: number;
  requireSimulation: boolean;
  cooldownMs?: number;
  maxRiskScore?: number;
}

export interface USDPolicy {
  maxTransactionUSD?: number;
  maxDailyExposureUSD?: number;
  maxPortfolioExposurePercentage?: number;
  maxDrawdownUSD?: number;
}

export interface PolicyViolation {
  code: string;
  message: string;
}
