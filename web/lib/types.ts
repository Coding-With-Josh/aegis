export interface NodeAgentPolicy {
  allowedIntents: string[];
  allowedMints: string[];
  maxTxAmountSOL: number;
  dailySpendLimitSOL: number;
  maxSlippageBps: number;
  requireSimulation: boolean;
  cooldownMs?: number;
  maxRiskScore?: number;
}

export interface NodeTransaction {
  id: string;
  agent_id: string;
  intent_type: string;
  reasoning: string | null;
  signature: string | null;
  slot: number | null;
  amount: number | null;
  token_mint: string | null;
  status: string;
  created_at: string;
}

export interface NodeAgentState {
  agentId: string;
  publicKey: string;
  status: string;
  createdAt: string;
  lastActivityAt: string | null;
  reputationScore: number;
  policy: NodeAgentPolicy;
  balanceSol: number;
  dailySpend: { sol: number; usdc: number; date: string };
  recentTxs: NodeTransaction[];
}

export interface RiskProfile {
  maxPct: number;
  allowedActions: string[];
  minReasoningLength?: number;
}

export interface AgentState {
  agentId: string;
  publicKey: string;
  agentName: string;
  provider: string;
  riskProfile: RiskProfile | null;
  balanceSol: number;
  lastAction: string | null;
  lastReasoning: string | null;
  lastTs: string | null;
  lastSig: string | null;
}

export interface DecisionEntry {
  ts: string;
  agentId: string;
  provider: string;
  action: string;
  reasoning: string;
  confidence: number;
  sig?: string;
  rejected: boolean;
  rejectionReason?: string;
  balanceLamports?: number;
}

export interface ApiState {
  ts: string;
  agents: AgentState[];
  recentHistory: DecisionEntry[];
}
