import { PublicKey } from "@solana/web3.js";

export interface TransferIntent {
  type: "transfer";
  to: PublicKey;
  lamports: number;
}

export interface TransferSPLIntent {
  type: "transferSpl";
  mint: PublicKey;
  to: PublicKey;
  amount: number;
}

export interface CallProgramIntent {
  type: "callProgram";
  programId: PublicKey;
  accounts: { pubkey: PublicKey; isSigner?: boolean; isWritable?: boolean }[];
  data: Buffer;
}

export type Intent = TransferIntent | TransferSPLIntent | CallProgramIntent;
