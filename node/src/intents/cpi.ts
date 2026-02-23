import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const AccountMetaSchema = z.object({
  pubkey: z.string(),
  isSigner: z.boolean(),
  isWritable: z.boolean(),
});

const CpiParamsSchema = z.object({
  programId: z.string().min(32),
  data: z.string(),
  accounts: z.array(AccountMetaSchema).max(32),
});

export type CpiParams = z.infer<typeof CpiParamsSchema>;

export class CpiIntentHandler implements IntentHandler {
  private params!: CpiParams;

  validate(params: unknown): void {
    const result = CpiParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid cpi params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;

    try {
      new PublicKey(this.params.programId);
    } catch {
      throw new Error(`invalid programId: ${this.params.programId}`);
    }

    for (const acc of this.params.accounts) {
      try {
        new PublicKey(acc.pubkey);
      } catch {
        throw new Error(`invalid account pubkey: ${acc.pubkey}`);
      }
    }
  }

  estimateImpact(_params: unknown): ImpactEstimate {
    return {
      amountSOL: 0,
      mint: "SOL",
      riskScore: 90,
    };
  }

  async buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);

    const accounts: AccountMeta[] = this.params.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    }));

    const ix = new TransactionInstruction({
      programId: new PublicKey(this.params.programId),
      keys: accounts,
      data: Buffer.from(this.params.data, "base64"),
    });

    const tx = new Transaction();
    tx.add(ix);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    return tx;
  }
}
