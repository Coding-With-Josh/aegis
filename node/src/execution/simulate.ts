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
  riskyEffects: boolean;
  riskReason: string | null;
}

const SOL_FLOOR_LAMPORTS = 10_000_000; // 0.01 SOL

export async function simulateTransaction(
  connection: Connection,
  tx: Transaction | VersionedTransaction,
  agent: AgentRow
): Promise<SimulationResult> {
  const keypair = getKeypairForAgent(agent.encrypted_private_key);
  const agentPubkey = keypair.publicKey.toBase58();

  let result: Awaited<ReturnType<typeof connection.simulateTransaction>>;

  if (tx instanceof VersionedTransaction) {
    result = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      accounts: {
        encoding: "base64",
        addresses: [agentPubkey],
      },
    });
  } else {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    result = await connection.simulateTransaction(tx, undefined, [new PublicKey(agentPubkey)]);
  }

  const meta = result.value;
  const logs = meta.logs ?? [];
  const unitsConsumed = meta.unitsConsumed ?? 0;

  interface TokenBalance {
    accountIndex: number;
    mint: string;
    owner?: string;
    uiTokenAmount: { amount: string };
  }
  const metaAny = meta as unknown as {
    postTokenBalances?: TokenBalance[];
    preTokenBalances?: TokenBalance[];
  };

  const tokenChanges: TokenChange[] = [];
  if (metaAny.postTokenBalances && metaAny.preTokenBalances) {
    const preMap = new Map(metaAny.preTokenBalances.map((b) => [`${b.accountIndex}`, b]));
    for (const post of metaAny.postTokenBalances) {
      const pre = preMap.get(`${post.accountIndex}`);
      const postAmt = Number(post.uiTokenAmount.amount);
      const preAmt = pre ? Number(pre.uiTokenAmount.amount) : 0;
      const delta = postAmt - preAmt;
      if (delta !== 0) {
        tokenChanges.push({
          mint: post.mint,
          delta,
          owner: post.owner ?? agentPubkey,
        });
      }
    }
  }

  const accountKeys = meta.accounts ?? [];
  const postBalances = accountKeys.map((acc, i) => ({
    address: i === 0 ? agentPubkey : `account_${i}`,
    lamports: acc?.lamports ?? 0,
  }));

  let riskyEffects = false;
  let riskReason: string | null = null;

  const agentPostBalance = postBalances.find((b) => b.address === agentPubkey);
  if (agentPostBalance && agentPostBalance.lamports < SOL_FLOOR_LAMPORTS) {
    riskyEffects = true;
    riskReason = `agent SOL balance would drop to ${(agentPostBalance.lamports / 1e9).toFixed(6)} SOL (below 0.01 SOL floor)`;
  }

  const negativeTokenChange = tokenChanges.find(
    (c) => c.delta < 0 && c.owner === agentPubkey
  );
  if (negativeTokenChange && !riskyEffects) {
    riskyEffects = true;
    riskReason = `simulation shows negative token delta of ${negativeTokenChange.delta} on mint ${negativeTokenChange.mint}`;
  }

  return {
    success: meta.err === null,
    error: meta.err ? JSON.stringify(meta.err) : null,
    logs,
    unitsConsumed,
    tokenChanges,
    postBalances,
    riskyEffects,
    riskReason,
  };
}
