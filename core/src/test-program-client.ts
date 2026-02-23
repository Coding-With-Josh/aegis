import { createHash } from "node:crypto";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { CallProgramIntent } from "./agents/intents.js";

export const AEGIS_TEST_PROGRAM_ID: PublicKey | null = process.env.AEGIS_TEST_PROGRAM_ID
  ? new PublicKey(process.env.AEGIS_TEST_PROGRAM_ID)
  : null;

function anchorDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export function counterPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], programId);
  return pda;
}

export function tradesPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("trades")], programId);
  return pda;
}

export function buildIncrementIntent(programId?: PublicKey | null): CallProgramIntent {
  const pid = programId ?? AEGIS_TEST_PROGRAM_ID;
  if (!pid) throw new Error("AEGIS_TEST_PROGRAM_ID not set in env");
  const counter = counterPda(pid);
  return {
    type: "callProgram",
    programId: pid,
    accounts: [
      { pubkey: counter, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(anchorDiscriminator("increment")),
  };
}

export function buildInitCounterIntent(
  authority: PublicKey,
  programId?: PublicKey | null
): CallProgramIntent {
  const pid = programId ?? AEGIS_TEST_PROGRAM_ID;
  if (!pid) throw new Error("AEGIS_TEST_PROGRAM_ID not set in env");
  const counter = counterPda(pid);
  const initDiscriminator = anchorDiscriminator("init_counter");
  return {
    type: "callProgram",
    programId: pid,
    accounts: [
      { pubkey: counter, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(initDiscriminator),
  };
}

export function buildTradeIntent(amount: number, programId?: PublicKey | null): CallProgramIntent {
  const pid = programId ?? AEGIS_TEST_PROGRAM_ID;
  if (!pid) throw new Error("AEGIS_TEST_PROGRAM_ID not set in env");
  const trades = tradesPda(pid);
  const disc = anchorDiscriminator("trade");
  const buf = Buffer.allocUnsafe(8 + 8);
  disc.copy(buf, 0);
  buf.writeBigUInt64LE(BigInt(amount), 8);
  return {
    type: "callProgram",
    programId: pid,
    accounts: [{ pubkey: trades, isSigner: false, isWritable: true }],
    data: buf,
  };
}

export function buildInitTradesIntent(
  authority: PublicKey,
  programId?: PublicKey | null
): CallProgramIntent {
  const pid = programId ?? AEGIS_TEST_PROGRAM_ID;
  if (!pid) throw new Error("AEGIS_TEST_PROGRAM_ID not set in env");
  const trades = tradesPda(pid);
  const initDiscriminator = anchorDiscriminator("init_trades");
  return {
    type: "callProgram",
    programId: pid,
    accounts: [
      { pubkey: trades, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(initDiscriminator),
  };
}
