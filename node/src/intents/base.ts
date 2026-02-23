import type { Connection, Transaction } from "@solana/web3.js";
import type { AgentRow } from "../db.js";

export interface ImpactEstimate {
  amountSOL: number;
  mint: string;
}

export interface IntentHandler {
  validate(params: unknown): void;
  buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction>;
  estimateImpact(params: unknown): ImpactEstimate;
}
