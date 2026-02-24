import { v4 as uuidv4 } from "uuid";
import {
  insertPendingTransaction,
  getPendingTransactions,
  getPendingTransactionById,
  updatePendingTransactionStatus,
  expireStalePendingTransactions,
  getAgentById,
} from "../db.js";
import { notifyWebhook } from "../fiat/funding.js";
import type { SimulationReport } from "../execution/simulate.js";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

export async function storePendingTx(params: {
  agentId: string;
  intent: { type: string; params: Record<string, unknown> };
  intentHash: string;
  policyHash: string;
  reasoning: string;
  usdValue: number | null;
  simulation: SimulationReport | null;
}): Promise<string> {
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_TTL_MS).toISOString();

  insertPendingTransaction({
    id,
    agent_id: params.agentId,
    intent_json: JSON.stringify(params.intent),
    intent_hash: params.intentHash,
    policy_hash: params.policyHash,
    reasoning: params.reasoning,
    usd_value: params.usdValue,
    simulation_json: params.simulation ? JSON.stringify(params.simulation) : null,
    status: "awaiting_approval",
    expires_at: expiresAt,
    webhook_notified: 0,
    created_at: now.toISOString(),
  });

  const agent = getAgentById(params.agentId);
  if (agent?.webhook_url) {
    await notifyWebhook(agent.webhook_url, {
      event: "pending_approval",
      pendingId: id,
      agentId: params.agentId,
      intent: params.intent,
      intentHash: params.intentHash,
      usdValue: params.usdValue,
      expiresAt,
    });
  }

  return id;
}

export function listPendingTx(agentId: string): PendingTxSummary[] {
  return getPendingTransactions(agentId).map(rowToSummary);
}

export function approvePendingTx(txId: string, agentId: string): PendingTxSummary {
  const row = getPendingTransactionById(txId);
  if (!row) throw new Error(`pending transaction ${txId} not found`);
  if (row.agent_id !== agentId) throw new Error("pending transaction does not belong to this agent");
  if (row.status !== "awaiting_approval") throw new Error(`pending transaction is already ${row.status}`);
  if (new Date(row.expires_at) < new Date()) {
    updatePendingTransactionStatus(txId, "expired");
    throw new Error("pending transaction has expired");
  }
  updatePendingTransactionStatus(txId, "approved");
  return rowToSummary({ ...row, status: "approved" });
}

export function rejectPendingTx(txId: string, agentId: string): PendingTxSummary {
  const row = getPendingTransactionById(txId);
  if (!row) throw new Error(`pending transaction ${txId} not found`);
  if (row.agent_id !== agentId) throw new Error("pending transaction does not belong to this agent");
  if (row.status !== "awaiting_approval") throw new Error(`pending transaction is already ${row.status}`);
  updatePendingTransactionStatus(txId, "rejected");
  return rowToSummary({ ...row, status: "rejected" });
}

export function expireStalePending(): void {
  expireStalePendingTransactions();
}

function rowToSummary(row: {
  id: string;
  agent_id: string;
  intent_json: string;
  intent_hash: string;
  policy_hash: string;
  reasoning: string | null;
  usd_value: number | null;
  simulation_json: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}): PendingTxSummary {
  return {
    id: row.id,
    agentId: row.agent_id,
    intent: JSON.parse(row.intent_json) as { type: string; params: Record<string, unknown> },
    intentHash: row.intent_hash,
    policyHash: row.policy_hash,
    reasoning: row.reasoning,
    usdValue: row.usd_value,
    simulation: row.simulation_json ? JSON.parse(row.simulation_json) as SimulationReport : null,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
