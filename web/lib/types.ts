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

export interface SimulationReport {
  success: boolean;
  error: string | null;
  logs: string[];
  computeUnitForecast: number;
  tokenChanges: { mint: string; delta: number; owner: string }[];
  postBalances: { address: string; lamports: number }[];
  slippageActual: number | null;
  expectedDeltaViolation: boolean;
  riskyEffects: boolean;
  riskReason: string | null;
  usdImpactEstimate: number | null;
}

export interface PendingTxSummary {
  id: string;
  agentId: string;
  intent: { type: string; params: Record<string, unknown> };
  intentHash: string;
  policyHash: string;
  reasoning: string | null;
  usdValue: number | null;
  simulation: SimulationReport | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuditEntry {
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
  simulationResult: SimulationReport | null;
  approvalState: "auto" | "approved" | "rejected" | "pending";
  finalTxSignature: string | null;
  timestamp: string;
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
  executionMode?: string;
  createdAt: string;
  lastActivityAt: string | null;
  reputationScore: number;
  policy: NodeAgentPolicy;
  balanceSol: number;
  dailySpend: { sol: number; usdc: number; date: string };
  recentTxs: NodeTransaction[];
  pending: PendingTxSummary[];
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
