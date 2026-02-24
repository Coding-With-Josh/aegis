import { v4 as uuidv4 } from "uuid";
import { insertCapitalEvent } from "../db.js";
import type { AgentRow } from "../db.js";

export interface FundingAlert {
  agentId: string;
  balanceUSD: number;
  minOperationalUSD: number;
  message: string;
}

// fires a webhook POST if the agent has a webhook_url configured
export async function notifyWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // webhook delivery is best-effort, never throw
  }
}

// called when balance drops below min_operational_usd
export async function triggerFundingAlert(agent: AgentRow, balanceUSD: number): Promise<FundingAlert | null> {
  const min = agent.min_operational_usd ?? 5.0;
  if (balanceUSD >= min) return null;

  const alert: FundingAlert = {
    agentId: agent.id,
    balanceUSD,
    minOperationalUSD: min,
    message: `agent balance $${balanceUSD.toFixed(2)} is below minimum operational threshold $${min.toFixed(2)}`,
  };

  if (agent.webhook_url) {
    await notifyWebhook(agent.webhook_url, { event: "low_balance", ...alert });
  }

  return alert;
}

// logs an on-chain funding event detected externally or manually
export function logFundingEvent(
  agentId: string,
  amountSol: number,
  amountUsd: number,
  sourceNote: string | null = null
): void {
  insertCapitalEvent({
    id: uuidv4(),
    agent_id: agentId,
    event_type: "funding",
    amount_sol: amountSol,
    amount_usd: amountUsd,
    source_note: sourceNote,
    created_at: new Date().toISOString(),
  });
}
