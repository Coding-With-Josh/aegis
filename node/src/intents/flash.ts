import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AccountMeta,
} from "@solana/web3.js";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const SerializedInstructionSchema = z.object({
  programId: z.string(),
  data: z.string(),
  accounts: z.array(
    z.object({
      pubkey: z.string(),
      isSigner: z.boolean(),
      isWritable: z.boolean(),
    })
  ),
});

const FlashParamsSchema = z.object({
  mint: z.string().min(32),
  amount: z.number().positive(),
  instructions: z.array(SerializedInstructionSchema).min(1).max(10),
});

export type FlashParams = z.infer<typeof FlashParamsSchema>;

export class FlashIntentHandler implements IntentHandler {
  private params!: FlashParams;

  validate(params: unknown): void {
    const result = FlashParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid flash params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;

    try {
      new PublicKey(this.params.mint);
    } catch {
      throw new Error(`invalid mint address: ${this.params.mint}`);
    }
  }

  estimateImpact(params: unknown): ImpactEstimate {
    const p = FlashParamsSchema.parse(params);
    return {
      amountSOL: 0,
      mint: p.mint,
      riskScore: Math.min(70 + p.instructions.length * 2, 90),
    };
  }

  async buildTransaction(agent: AgentRow, connection: Connection): Promise<VersionedTransaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);

    const userInstructions: TransactionInstruction[] = this.params.instructions.map((ix) => {
      const accounts: AccountMeta[] = ix.accounts.map((a) => ({
        pubkey: new PublicKey(a.pubkey),
        isSigner: a.isSigner,
        isWritable: a.isWritable,
      }));
      return new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: accounts,
        data: Buffer.from(ix.data, "base64"),
      });
    });

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: userInstructions,
    }).compileToV0Message();

    return new VersionedTransaction(message);
  }
}
