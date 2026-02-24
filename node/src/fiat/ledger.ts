import { getCapitalEvents, getTransactionsByAgent } from "../db.js";

export interface CapitalLedgerState {
  agentId: string;
  totalInjectedUSD: number;
  realizedPnlUSD: number;
  unrealizedExposureUSD: number;
  agentROI: number;
  totalTxCount: number;
  totalVolumeUSD: number;
}

export function computeLedgerState(agentId: string, currentPortfolioUSD: number): CapitalLedgerState {
  const events = getCapitalEvents(agentId, 1000);
  const txs = getTransactionsByAgent(agentId, 1000);

  let totalInjectedUSD = 0;
  let realizedPnlUSD = 0;

  for (const ev of events) {
    if (ev.event_type === "funding") {
      totalInjectedUSD += ev.amount_usd ?? 0;
    } else if (ev.event_type === "pnl_snapshot") {
      realizedPnlUSD += ev.amount_usd ?? 0;
    }
  }

  const totalVolumeUSD = txs
    .filter((t) => t.status === "confirmed")
    .reduce((sum, t) => sum + (t.usd_value ?? 0), 0);

  const unrealizedExposureUSD = currentPortfolioUSD;
  const agentROI = totalInjectedUSD > 0
    ? ((currentPortfolioUSD - totalInjectedUSD) / totalInjectedUSD) * 100
    : 0;

  return {
    agentId,
    totalInjectedUSD,
    realizedPnlUSD,
    unrealizedExposureUSD,
    agentROI,
    totalTxCount: txs.filter((t) => t.status === "confirmed").length,
    totalVolumeUSD,
  };
}
