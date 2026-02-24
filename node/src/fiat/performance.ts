import { getTransactionsByAgent } from "../db.js";

export interface PerformanceSummary {
  agentId: string;
  confirmedTxCount: number;
  failedTxCount: number;
  rejectedTxCount: number;
  totalVolumeSOL: number;
  totalVolumeUSD: number;
  successRate: number;
}

export function computePerformance(agentId: string): PerformanceSummary {
  const txs = getTransactionsByAgent(agentId, 1000);

  const confirmed = txs.filter((t) => t.status === "confirmed");
  const failed = txs.filter((t) => t.status === "failed");
  const rejected = txs.filter((t) => t.status.startsWith("rejected"));

  const totalVolumeSOL = confirmed.reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalVolumeUSD = confirmed.reduce((s, t) => s + (t.usd_value ?? 0), 0);
  const successRate = txs.length > 0 ? confirmed.length / txs.length : 0;

  return {
    agentId,
    confirmedTxCount: confirmed.length,
    failedTxCount: failed.length,
    rejectedTxCount: rejected.length,
    totalVolumeSOL,
    totalVolumeUSD,
    successRate,
  };
}
