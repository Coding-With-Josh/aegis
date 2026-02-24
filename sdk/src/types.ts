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

export interface AgentTransaction {
  id: string;
  agent_id: string;
  intent_type: string;
  reasoning: string | null;
  signature: string | null;
  slot: number | null;
  amount: number | null;
  token_mint: string | null;
  status: "confirmed" | "rejected_policy" | "rejected_simulation" | "failed";
  created_at: string;
  policy_hash: string | null;
  intent_hash: string | null;
  usd_value: number | null;
}

export interface AgentInfo {
  agentId: string;
  publicKey: string;
  status: "active" | "paused" | "suspended";
  executionMode: "autonomous" | "supervised";
  createdAt: string;
  lastActivityAt: string | null;
  reputationScore: number;
  policy: AgentPolicy;
  usdPolicy: USDPolicy | null;
  webhookUrl: string | null;
}

export interface AgentBalance {
  agentId: string;
  publicKey: string;
  balanceSol: number;
  balanceLamports: number;
  dailySpend: {
    sol: number;
    usdc: number;
    date: string;
  };
}

export interface CapitalLedger {
  agentId: string;
  totalInjectedUSD: number;
  realizedPnlUSD: number;
  unrealizedExposureUSD: number;
  agentROI: number;
  totalTxCount: number;
  totalVolumeUSD: number;
}

export interface AuditArtifact {
  id: string;
  agentId: string;
  intent: { type: string; params: Record<string, unknown> };
  intentHash: string;
  policyHash: string;
  usdRiskCheck: {
    usdValue: number;
    passed: boolean;
    violations: string[];
  } | null;
  simulationResult: unknown | null;
  approvalState: "auto" | "approved" | "rejected" | "pending";
  finalTxSignature: string | null;
  timestamp: string;
}

export interface PendingTransaction {
  id: string;
  agentId: string;
  intent: { type: string; params: Record<string, unknown> };
  intentHash: string;
  policyHash: string;
  reasoning: string | null;
  usdValue: number | null;
  simulation: unknown | null;
  status: "awaiting_approval" | "approved" | "rejected" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface PolicyVersion {
  agent_id: string;
  version: number;
  policy_hash: string;
  policy_json: string;
  created_at: string;
}

export interface CreateAgentResult {
  agentId: string;
  publicKey: string;
  apiKey: string;
  note: string;
}

export interface ExecutionReceipt {
  signature: string;
  slot: number;
  gasUsed: number;
  tokenChanges: { mint: string; delta: number }[];
  postBalances: { address: string; lamports: number }[];
}

export interface PolicyViolation {
  code: string;
  message: string;
}

export interface AegisClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface Intent {
  type: string;
  params: Record<string, unknown>;
}
