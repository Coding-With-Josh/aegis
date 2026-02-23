import type { AgentPolicy, PolicyViolation } from "./types.js";
import { getSpend } from "../db.js";

export class PolicyEngine {
  constructor(
    private readonly agentId: string,
    private readonly policy: AgentPolicy
  ) {}

  checkIntentType(intentType: string): PolicyViolation | null {
    if (!this.policy.allowedIntents.includes(intentType)) {
      return {
        code: "INTENT_NOT_ALLOWED",
        message: `intent type "${intentType}" is not in allowedIntents: [${this.policy.allowedIntents.join(", ")}]`,
      };
    }
    return null;
  }

  checkMint(mint: string): PolicyViolation | null {
    if (!this.policy.allowedMints.includes(mint)) {
      return {
        code: "MINT_NOT_ALLOWED",
        message: `mint "${mint}" is not in allowedMints: [${this.policy.allowedMints.join(", ")}]`,
      };
    }
    return null;
  }

  checkTxAmount(amountSOL: number): PolicyViolation | null {
    if (amountSOL > this.policy.maxTxAmountSOL) {
      return {
        code: "AMOUNT_EXCEEDS_TX_CAP",
        message: `amount ${amountSOL} SOL exceeds maxTxAmountSOL ${this.policy.maxTxAmountSOL}`,
      };
    }
    return null;
  }

  checkDailySpend(amountSOL: number): PolicyViolation | null {
    const today = utcDate();
    const spend = getSpend(this.agentId, today);
    const projected = spend.total_spent_sol + amountSOL;
    if (projected > this.policy.dailySpendLimitSOL) {
      return {
        code: "DAILY_SPEND_LIMIT_EXCEEDED",
        message: `projected daily spend ${projected.toFixed(4)} SOL exceeds limit ${this.policy.dailySpendLimitSOL} SOL`,
      };
    }
    return null;
  }

  checkSlippage(slippageBps: number): PolicyViolation | null {
    if (slippageBps > this.policy.maxSlippageBps) {
      return {
        code: "SLIPPAGE_TOO_HIGH",
        message: `slippage ${slippageBps} bps exceeds maxSlippageBps ${this.policy.maxSlippageBps}`,
      };
    }
    return null;
  }

  checkCooldown(lastActivityTs: string | null): PolicyViolation | null {
    if (!this.policy.cooldownMs || !lastActivityTs) return null;
    const elapsed = Date.now() - new Date(lastActivityTs).getTime();
    if (elapsed < this.policy.cooldownMs) {
      const remaining = Math.ceil((this.policy.cooldownMs - elapsed) / 1000);
      return {
        code: "COOLDOWN_ACTIVE",
        message: `agent is in cooldown, ${remaining}s remaining`,
      };
    }
    return null;
  }

  checkRiskScore(riskScore: number): PolicyViolation | null {
    const max = this.policy.maxRiskScore;
    if (max === undefined) return null;
    if (riskScore > max) {
      return {
        code: "RISK_SCORE_TOO_HIGH",
        message: `intent risk score ${riskScore} exceeds maxRiskScore ${max}`,
      };
    }
    return null;
  }

  enforce(violations: (PolicyViolation | null)[]): void {
    const actual = violations.filter((v): v is PolicyViolation => v !== null);
    if (actual.length > 0) {
      const messages = actual.map((v) => `[${v.code}] ${v.message}`).join("; ");
      throw new PolicyError(messages, actual);
    }
  }
}

export class PolicyError extends Error {
  constructor(
    message: string,
    public readonly violations: PolicyViolation[]
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

export function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
