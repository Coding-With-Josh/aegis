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
}

export interface AgentInfo {
  agentId: string;
  publicKey: string;
  status: "active" | "paused" | "suspended";
  createdAt: string;
  lastActivityAt: string | null;
  reputationScore: number;
  policy: AgentPolicy;
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
