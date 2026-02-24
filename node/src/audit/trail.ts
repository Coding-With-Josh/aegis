import { v4 as uuidv4 } from "uuid";
import { insertAuditLog, getAuditLogByAgent } from "../db.js";
import type { SimulationReport } from "../execution/simulate.js";

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
  simulationResult: SimulationReport | null;
  approvalState: "auto" | "approved" | "rejected" | "pending";
  finalTxSignature: string | null;
  timestamp: string;
}

export function writeAuditArtifact(artifact: AuditArtifact): void {
  insertAuditLog({
    id: artifact.id,
    agent_id: artifact.agentId,
    intent_hash: artifact.intentHash,
    policy_hash: artifact.policyHash,
    intent_json: JSON.stringify(artifact.intent),
    usd_risk_check_json: artifact.usdRiskCheck ? JSON.stringify(artifact.usdRiskCheck) : null,
    simulation_json: artifact.simulationResult ? JSON.stringify(artifact.simulationResult) : null,
    approval_state: artifact.approvalState,
    final_tx_signature: artifact.finalTxSignature,
    created_at: artifact.timestamp,
  });
}

export function getAuditLog(agentId: string, limit = 50): AuditArtifact[] {
  return getAuditLogByAgent(agentId, limit).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    intent: JSON.parse(row.intent_json) as { type: string; params: Record<string, unknown> },
    intentHash: row.intent_hash,
    policyHash: row.policy_hash,
    usdRiskCheck: row.usd_risk_check_json
      ? JSON.parse(row.usd_risk_check_json) as AuditArtifact["usdRiskCheck"]
      : null,
    simulationResult: row.simulation_json
      ? JSON.parse(row.simulation_json) as SimulationReport
      : null,
    approvalState: row.approval_state as AuditArtifact["approvalState"],
    finalTxSignature: row.final_tx_signature,
    timestamp: row.created_at,
  }));
}

export function exportAuditJSON(agentId: string): string {
  return JSON.stringify(getAuditLog(agentId, 10000), null, 2);
}

export function makeAuditId(): string {
  return uuidv4();
}
