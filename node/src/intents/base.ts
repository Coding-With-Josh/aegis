import type { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { AgentRow } from "../db.js";

export interface ImpactEstimate {
  amountSOL: number;
  mint: string;
  riskScore: number;
}

export interface IntentHandler {
  validate(params: unknown): void;
  buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction | VersionedTransaction>;
  estimateImpact(params: unknown): ImpactEstimate;
}
