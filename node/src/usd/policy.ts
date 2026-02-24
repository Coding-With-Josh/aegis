import type { PolicyViolation } from "../policy/types.js";
import { getSpend } from "../db.js";
import { utcDate } from "../policy/engine.js";

export interface USDPolicy {
  maxTransactionUSD?: number;
  maxDailyExposureUSD?: number;
  maxPortfolioExposurePercentage?: number;
  maxDrawdownUSD?: number;
}

export class USDPolicyEngine {
  constructor(
    private readonly agentId: string,
    private readonly policy: USDPolicy
  ) {}

  checkTxUSD(usdValue: number): PolicyViolation | null {
    const max = this.policy.maxTransactionUSD;
    if (max === undefined) return null;
    if (usdValue > max) {
      return {
        code: "TX_USD_EXCEEDS_CAP",
        message: `transaction value $${usdValue.toFixed(2)} exceeds maxTransactionUSD $${max.toFixed(2)}`,
      };
    }
    return null;
  }

  checkDailyUSD(usdValue: number): PolicyViolation | null {
    const max = this.policy.maxDailyExposureUSD;
    if (max === undefined) return null;
    const today = utcDate();
    const spend = getSpend(this.agentId, today);
    const projected = spend.total_spent_usd + usdValue;
    if (projected > max) {
      return {
        code: "DAILY_USD_LIMIT_EXCEEDED",
        message: `projected daily USD exposure $${projected.toFixed(2)} exceeds maxDailyExposureUSD $${max.toFixed(2)}`,
      };
    }
    return null;
  }

  checkPortfolioExposure(usdValue: number, portfolioUSD: number): PolicyViolation | null {
    const maxPct = this.policy.maxPortfolioExposurePercentage;
    if (maxPct === undefined || portfolioUSD === 0) return null;
    const pct = (usdValue / portfolioUSD) * 100;
    if (pct > maxPct) {
      return {
        code: "PORTFOLIO_EXPOSURE_TOO_HIGH",
        message: `transaction is ${pct.toFixed(1)}% of portfolio, exceeds maxPortfolioExposurePercentage ${maxPct}%`,
      };
    }
    return null;
  }

  checkDrawdown(currentPortfolioUSD: number, peakPortfolioUSD: number): PolicyViolation | null {
    const maxDrawdown = this.policy.maxDrawdownUSD;
    if (maxDrawdown === undefined || peakPortfolioUSD === 0) return null;
    const drawdown = peakPortfolioUSD - currentPortfolioUSD;
    if (drawdown > maxDrawdown) {
      return {
        code: "DRAWDOWN_LIMIT_EXCEEDED",
        message: `portfolio drawdown $${drawdown.toFixed(2)} exceeds maxDrawdownUSD $${maxDrawdown.toFixed(2)}`,
      };
    }
    return null;
  }

  enforce(violations: (PolicyViolation | null)[]): void {
    const actual = violations.filter((v): v is PolicyViolation => v !== null);
    if (actual.length > 0) {
      const messages = actual.map((v) => `[${v.code}] ${v.message}`).join("; ");
      throw new USDPolicyError(messages, actual);
    }
  }
}

export class USDPolicyError extends Error {
  constructor(
    message: string,
    public readonly violations: PolicyViolation[]
  ) {
    super(message);
    this.name = "USDPolicyError";
  }
}
