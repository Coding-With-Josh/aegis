import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getKeypair } from "../keystore/index.js";
import type { Intent } from "../agents/intents.js";
import { validateIntent, type ExecutionPolicy } from "./policy.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

// lightweight oracle fetch — tries coingecko, returns 0 on failure
async function getSolPriceUSD(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return 0;
    const data = await res.json() as { solana?: { usd?: number } };
    return data.solana?.usd ?? 0;
  } catch {
    return 0;
  }
}

const DEFAULT_KEYSTORE_DIR = ".aegis/keystore";

export interface ExecuteOptions {
  keystoreDir?: string;
  policy?: ExecutionPolicy;
}

export async function executeIntent(
  connection: Connection,
  agentId: string,
  intent: Intent,
  passphrase: string,
  keystoreDirOrOpts: string | ExecuteOptions = DEFAULT_KEYSTORE_DIR
): Promise<string> {
  const opts: ExecuteOptions =
    typeof keystoreDirOrOpts === "string"
      ? { keystoreDir: keystoreDirOrOpts }
      : keystoreDirOrOpts;
  const keystoreDir = opts.keystoreDir ?? DEFAULT_KEYSTORE_DIR;

  if (opts.policy) {
    validateIntent(intent, opts.policy);

    // usd cap check for transfer intents
    if (opts.policy.maxTransferUSD !== undefined && intent.type === "transfer") {
      const solPrice = await getSolPriceUSD();
      if (solPrice > 0) {
        const usdValue = (intent.lamports / 1e9) * solPrice;
        if (usdValue > opts.policy.maxTransferUSD) {
          throw new Error(
            `transfer value $${usdValue.toFixed(2)} exceeds maxTransferUSD $${opts.policy.maxTransferUSD.toFixed(2)}`
          );
        }
      }
    }
  }

  const signer = await getKeypair(agentId, passphrase, keystoreDir);
  const tx = new Transaction();

  if (intent.type === "transfer") {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: intent.to,
        lamports: intent.lamports,
      })
    );
  } else if (intent.type === "transferSpl") {
    const sourceAta = getAssociatedTokenAddressSync(
      intent.mint,
      signer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const destAta = getAssociatedTokenAddressSync(
      intent.mint,
      intent.to,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const acc = await connection.getAccountInfo(destAta);
    if (!acc) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          signer.publicKey,
          destAta,
          intent.to,
          intent.mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    tx.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        signer.publicKey,
        intent.amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  } else if (intent.type === "callProgram") {
    tx.add(
      new TransactionInstruction({
        programId: intent.programId,
        keys: intent.accounts.map((a) => ({
          pubkey: a.pubkey,
          isSigner: a.isSigner ?? false,
          isWritable: a.isWritable ?? true,
        })),
        data: intent.data,
      })
    );
  } else {
    throw new Error("unknown intent type");
  }

  const sig = await sendAndConfirmTransaction(connection, tx, [signer], {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return sig;
}

export { validateIntent, defaultPolicy, buildDefaultAllowedPrograms } from "./policy.js";
export type { ExecutionPolicy } from "./policy.js";
