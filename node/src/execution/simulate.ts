import { Connection, Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

export interface TokenChange {
  mint: string;
  delta: number;
  owner: string;
}

export interface SimulationReport {
  success: boolean;
  error: string | null;
  logs: string[];
  computeUnitForecast: number;
  tokenChanges: TokenChange[];
  postBalances: { address: string; lamports: number }[];
  slippageActual: number | null;
  expectedDeltaViolation: boolean;
  riskyEffects: boolean;
  riskReason: string | null;
  usdImpactEstimate: number | null;
}

// kept for backwards compat — callers that typed SimulationResult still work
export type SimulationResult = SimulationReport;

const SOL_FLOOR_LAMPORTS = 10_000_000;
const COMPUTE_BUFFER_PCT = 0.1;

export async function simulateTransaction(
  connection: Connection,
  tx: Transaction | VersionedTransaction,
  agent: AgentRow,
  opts?: {
    expectedAmountSOL?: number;
    expectedMint?: string;
    usdImpactEstimate?: number;
  }
): Promise<SimulationReport> {
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
  const rawUnits = meta.unitsConsumed ?? 0;
  const computeUnitForecast = Math.ceil(rawUnits * (1 + COMPUTE_BUFFER_PCT));

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

  const negativeTokenChange = tokenChanges.find((c) => c.delta < 0 && c.owner === agentPubkey);
  if (negativeTokenChange && !riskyEffects) {
    riskyEffects = true;
    riskReason = `simulation shows negative token delta of ${negativeTokenChange.delta} on mint ${negativeTokenChange.mint}`;
  }

  // compute slippageActual for swaps: ratio of output token delta to input token delta
  let slippageActual: number | null = null;
  if (tokenChanges.length >= 2) {
    const outChange = tokenChanges.find((c) => c.delta > 0 && c.owner === agentPubkey);
    const inChange = tokenChanges.find((c) => c.delta < 0 && c.owner === agentPubkey);
    if (outChange && inChange && opts?.expectedAmountSOL) {
      const expectedOut = opts.expectedAmountSOL;
      const actualOut = Math.abs(outChange.delta);
      if (expectedOut > 0) {
        slippageActual = ((expectedOut - actualOut) / expectedOut) * 100;
      }
    }
  }

  // check if actual delta deviates more than 5% from expected
  let expectedDeltaViolation = false;
  if (opts?.expectedAmountSOL !== undefined && slippageActual !== null) {
    expectedDeltaViolation = Math.abs(slippageActual) > 5;
  }

  return {
    success: meta.err === null,
    error: meta.err ? JSON.stringify(meta.err) : null,
    logs,
    computeUnitForecast,
    tokenChanges,
    postBalances,
    slippageActual,
    expectedDeltaViolation,
    riskyEffects,
    riskReason,
    usdImpactEstimate: opts?.usdImpactEstimate ?? null,
  };
}
