import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { Intent } from "../agents/intents.js";

const LAMPORTS_PER_SOL = 1e9;
const DEFAULT_MAX_TRANSFER = 1 * LAMPORTS_PER_SOL;

export interface ExecutionPolicy {
  allowedRecipients: Set<string>;
  allowedProgramIds: Set<string>;
  maxTransferLamports: number;
}

function toSet(keys: PublicKey[]): Set<string> {
  const s = new Set<string>();
  for (const k of keys) s.add(k.toBase58());
  return s;
}

export function defaultPolicy(allowedRecipients: PublicKey[], allowedProgramIds: PublicKey[]): ExecutionPolicy {
  const max = process.env.MAX_TRANSFER_LAMPORTS;
  return {
    allowedRecipients: toSet(allowedRecipients),
    allowedProgramIds: toSet(allowedProgramIds),
    maxTransferLamports: max ? parseInt(max, 10) : DEFAULT_MAX_TRANSFER,
  };
}

export function validateIntent(intent: Intent, policy: ExecutionPolicy): void {
  if (intent.type === "transfer") {
    const to = intent.to.toBase58();
    if (!policy.allowedRecipients.has(to)) {
      throw new Error(`transfer not allowed: recipient ${to} not in allowlist`);
    }
    if (intent.lamports > policy.maxTransferLamports) {
      throw new Error(
        `transfer cap exceeded: ${intent.lamports} > ${policy.maxTransferLamports} (set MAX_TRANSFER_LAMPORTS to override)`
      );
    }
    if (intent.lamports <= 0) {
      throw new Error("transfer amount must be positive");
    }
    return;
  }
  if (intent.type === "transferSpl") {
    const to = intent.to.toBase58();
    if (!policy.allowedRecipients.has(to)) {
      throw new Error(`transferSpl not allowed: recipient ${to} not in allowlist`);
    }
    if (intent.amount <= 0) {
      throw new Error("transferSpl amount must be positive");
    }
    return;
  }
  if (intent.type === "callProgram") {
    const pid = intent.programId.toBase58();
    if (!policy.allowedProgramIds.has(pid)) {
      throw new Error(`program not allowed: ${pid} not in allowlist`);
    }
    return;
  }
  throw new Error("unknown intent type");
}

export function buildDefaultAllowedPrograms(testProgramId: PublicKey | null): PublicKey[] {
  const out: PublicKey[] = [SystemProgram.programId];
  if (testProgramId) out.push(testProgramId);
  const extra = process.env.ALLOWED_PROGRAM_IDS;
  if (extra) {
    for (const b58 of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      out.push(new PublicKey(b58));
    }
  }
  return out;
}
