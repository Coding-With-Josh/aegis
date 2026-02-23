import { upsertSpend, getSpend } from "../db.js";
import { utcDate } from "../policy/engine.js";

const SOL_MINT = "SOL";
const USDC_SYMBOL = "USDC";

export function recordSpend(agentId: string, amountSOL: number, mint: string): void {
  const date = utcDate();
  const isUsdc = mint.toUpperCase() === USDC_SYMBOL;
  upsertSpend(agentId, date, isUsdc ? 0 : amountSOL, isUsdc ? amountSOL : 0);
}

export function getDailySpend(agentId: string): { sol: number; usdc: number; date: string } {
  const date = utcDate();
  const row = getSpend(agentId, date);
  return { sol: row.total_spent_sol, usdc: row.total_spent_usdc, date };
}
