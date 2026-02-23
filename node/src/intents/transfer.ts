import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const SOL_MINT = "SOL";

const TransferParamsSchema = z.object({
  to: z.string().min(32),
  amount: z.number().positive(),
  mint: z.string().default(SOL_MINT),
});

export type TransferParams = z.infer<typeof TransferParamsSchema>;

export class TransferIntentHandler implements IntentHandler {
  private params!: TransferParams;

  validate(params: unknown): void {
    const result = TransferParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid transfer params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;

    try {
      new PublicKey(this.params.to);
    } catch {
      throw new Error(`invalid recipient address: ${this.params.to}`);
    }
  }

  estimateImpact(params: unknown): ImpactEstimate {
    const p = TransferParamsSchema.parse(params);
    return {
      amountSOL: p.mint === SOL_MINT ? p.amount : 0,
      mint: p.mint,
    };
  }

  async buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);
    const toPubkey = new PublicKey(this.params.to);
    const tx = new Transaction();

    if (this.params.mint === SOL_MINT) {
      const lamports = Math.floor(this.params.amount * LAMPORTS_PER_SOL);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports,
        })
      );
    } else {
      const mintPubkey = new PublicKey(this.params.mint);
      const sourceAta = getAssociatedTokenAddressSync(
        mintPubkey,
        keypair.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        mintPubkey,
        toPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const destAccount = await connection.getAccountInfo(destAta);
      if (!destAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            destAta,
            toPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
      tx.add(
        createTransferInstruction(
          sourceAta,
          destAta,
          keypair.publicKey,
          this.params.amount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    return tx;
  }
}
