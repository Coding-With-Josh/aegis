import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const LendParamsSchema = z.object({
  protocol: z.enum(["marginfi", "solend"]),
  mint: z.string().min(32),
  amount: z.number().positive(),
  decimals: z.number().int().min(0).max(18).default(6),
});

export type LendParams = z.infer<typeof LendParamsSchema>;

export class LendIntentHandler implements IntentHandler {
  private params!: LendParams;

  validate(params: unknown): void {
    const result = LendParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid lend params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;

    try {
      new PublicKey(this.params.mint);
    } catch {
      throw new Error(`invalid mint address: ${this.params.mint}`);
    }
  }

  estimateImpact(params: unknown): ImpactEstimate {
    const p = LendParamsSchema.parse(params);
    return {
      amountSOL: 0,
      mint: p.mint,
      riskScore: 15,
    };
  }

  async buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);

    const rawAmount = Math.floor(this.params.amount * Math.pow(10, this.params.decimals));
    const memoData = JSON.stringify({
      op: "lend_deposit",
      protocol: this.params.protocol,
      mint: this.params.mint,
      amount: rawAmount,
    });

    const memoIx = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(memoData, "utf-8"),
    });

    const tx = new Transaction();
    tx.add(memoIx);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    return tx;
  }
}
