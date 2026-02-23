import { Connection, Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

export interface TokenChange {
  mint: string;
  delta: number;
  owner: string;
}

export interface SimulationResult {
  success: boolean;
  error: string | null;
  logs: string[];
  unitsConsumed: number;
  tokenChanges: TokenChange[];
  postBalances: { address: string; lamports: number }[];
}

export async function simulateTransaction(
  connection: Connection,
  tx: Transaction,
  agent: AgentRow
): Promise<SimulationResult> {
  const keypair = getKeypairForAgent(agent.encrypted_private_key);

  const versionedTx = (tx as unknown as { _versionedTx?: VersionedTransaction })._versionedTx;

  let result: Awaited<ReturnType<typeof connection.simulateTransaction>>;

  if (versionedTx) {
    result = await connection.simulateTransaction(versionedTx, {
      replaceRecentBlockhash: true,
    });
  } else {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    result = await connection.simulateTransaction(tx);
  }

  const meta = result.value;
  const logs = meta.logs ?? [];
  const unitsConsumed = meta.unitsConsumed ?? 0;

  const tokenChanges: TokenChange[] = [];
  if (meta.innerInstructions) {
    for (const log of logs) {
      const match = log.match(/Transfer: (\d+) tokens? from (.+) to (.+)/);
      if (match) {
        tokenChanges.push({
          mint: "unknown",
          delta: parseInt(match[1], 10),
          owner: match[3],
        });
      }
    }
  }

  const accountKeys = (meta as unknown as { accounts?: { lamports: number; owner: string }[] }).accounts ?? [];
  const postBalances = accountKeys.map((acc, i) => ({
    address: `account_${i}`,
    lamports: acc?.lamports ?? 0,
  }));

  return {
    success: meta.err === null,
    error: meta.err ? JSON.stringify(meta.err) : null,
    logs,
    unitsConsumed,
    tokenChanges,
    postBalances,
  };
}
