import {
  Connection,
  PublicKey,
  Transaction,
  StakeProgram,
  Authorized,
  Lockup,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const StakeParamsSchema = z.object({
  amount: z.number().positive(),
  voteAccount: z.string().min(32),
});

export type StakeParams = z.infer<typeof StakeParamsSchema>;

export class StakeIntentHandler implements IntentHandler {
  private params!: StakeParams;

  validate(params: unknown): void {
    const result = StakeParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid stake params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;

    try {
      new PublicKey(this.params.voteAccount);
    } catch {
      throw new Error(`invalid vote account address: ${this.params.voteAccount}`);
    }
  }

  estimateImpact(params: unknown): ImpactEstimate {
    const p = StakeParamsSchema.parse(params);
    const amountRisk = Math.min(p.amount * 3, 20);
    return {
      amountSOL: p.amount,
      mint: "SOL",
      riskScore: Math.round(15 + amountRisk),
    };
  }

  async buildTransaction(agent: AgentRow, connection: Connection): Promise<Transaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);
    const voteAccountPubkey = new PublicKey(this.params.voteAccount);

    const stakeKeypair = Keypair.generate();
    const lamports = Math.floor(this.params.amount * LAMPORTS_PER_SOL);

    const createStakeAccountTx = StakeProgram.createAccount({
      fromPubkey: keypair.publicKey,
      stakePubkey: stakeKeypair.publicKey,
      authorized: new Authorized(keypair.publicKey, keypair.publicKey),
      lockup: new Lockup(0, 0, keypair.publicKey),
      lamports,
    });

    const delegateTx = StakeProgram.delegate({
      stakePubkey: stakeKeypair.publicKey,
      authorizedPubkey: keypair.publicKey,
      votePubkey: voteAccountPubkey,
    });

    const tx = new Transaction();
    tx.add(...createStakeAccountTx.instructions);
    tx.add(...delegateTx.instructions);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.partialSign(stakeKeypair);

    return tx;
  }
}
