import {
  Connection,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { insertTransaction } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";
import { recordSpend } from "../spend/tracker.js";
import type { AgentRow } from "../db.js";
import type { SimulationResult } from "./simulate.js";

export interface ExecutionReceipt {
  signature: string;
  slot: number;
  gasUsed: number;
  tokenChanges: { mint: string; delta: number }[];
  postBalances: { address: string; lamports: number }[];
}

export async function executeTransaction(
  connection: Connection,
  tx: Transaction,
  agent: AgentRow,
  meta: {
    intentType: string;
    reasoning: string;
    amountSOL: number;
    mint: string;
    simulation: SimulationResult | null;
  }
): Promise<ExecutionReceipt> {
  const keypair = getKeypairForAgent(agent.encrypted_private_key);

  const versionedTx = (tx as unknown as { _versionedTx?: VersionedTransaction })._versionedTx;

  let signature: string;
  let slot = 0;

  if (versionedTx) {
    versionedTx.sign([keypair]);
    signature = await connection.sendTransaction(versionedTx, { skipPreflight: false });
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    slot = confirmation.context.slot;
  } else {
    signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    const txInfo = await connection.getTransaction(signature, { commitment: "confirmed" });
    slot = txInfo?.slot ?? 0;
  }

  const gasUsed = meta.simulation?.unitsConsumed ?? 0;
  const tokenChanges = meta.simulation?.tokenChanges ?? [];
  const postBalances = meta.simulation?.postBalances ?? [];

  insertTransaction({
    id: uuidv4(),
    agent_id: agent.id,
    intent_type: meta.intentType,
    reasoning: meta.reasoning,
    signature,
    slot,
    amount: meta.amountSOL,
    token_mint: meta.mint,
    status: "confirmed",
    created_at: new Date().toISOString(),
  });

  recordSpend(agent.id, meta.amountSOL, meta.mint);

  return { signature, slot, gasUsed, tokenChanges, postBalances };
}
