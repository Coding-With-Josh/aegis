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
