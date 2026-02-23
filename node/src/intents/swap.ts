import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { z } from "zod";
import type { IntentHandler, ImpactEstimate } from "./base.js";
import type { AgentRow } from "../db.js";
import { getKeypairForAgent } from "../agents/create.js";

const JUPITER_API = process.env.JUPITER_API_URL ?? "https://quote-api.jup.ag/v6";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const KNOWN_MINTS: Record<string, string> = {
  SOL: SOL_MINT,
  USDC: USDC_MINT,
};

function resolveMint(symbol: string): string {
  return KNOWN_MINTS[symbol.toUpperCase()] ?? symbol;
}

const SwapParamsSchema = z.object({
  fromMint: z.string(),
  toMint: z.string(),
  amount: z.number().positive(),
  slippageBps: z.number().int().min(0).max(10000).default(50),
});

export type SwapParams = z.infer<typeof SwapParamsSchema>;

export class SwapIntentHandler implements IntentHandler {
  private params!: SwapParams;

  validate(params: unknown): void {
    const result = SwapParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error(`invalid swap params: ${result.error.issues.map((i) => i.message).join(", ")}`);
    }
    this.params = result.data;
  }

  estimateImpact(params: unknown): ImpactEstimate {
    const p = SwapParamsSchema.parse(params);
    const fromMintResolved = resolveMint(p.fromMint);
    const isFromSol = fromMintResolved === SOL_MINT;
    const slippageRisk = Math.min(p.slippageBps / 100, 20);
    const amountRisk = Math.min(p.amount * 5, 30);
    return {
      amountSOL: isFromSol ? p.amount : 0,
      mint: p.fromMint,
      riskScore: Math.round(20 + slippageRisk + amountRisk),
    };
  }

  async buildTransaction(agent: AgentRow, _connection: never): Promise<VersionedTransaction> {
    const keypair = getKeypairForAgent(agent.encrypted_private_key);
    const fromMint = resolveMint(this.params.fromMint);
    const toMint = resolveMint(this.params.toMint);

    const isFromSol = fromMint === SOL_MINT;
    const decimals = isFromSol ? 9 : 6;
    const inputAmount = Math.floor(this.params.amount * Math.pow(10, decimals));

    const quoteUrl =
      `${JUPITER_API}/quote` +
      `?inputMint=${fromMint}` +
      `&outputMint=${toMint}` +
      `&amount=${inputAmount}` +
      `&slippageBps=${this.params.slippageBps}`;

    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      const text = await quoteRes.text();
      throw new Error(`jupiter quote failed: ${quoteRes.status} ${text}`);
    }
    const quoteData = await quoteRes.json() as Record<string, unknown>;

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!swapRes.ok) {
      const text = await swapRes.text();
      throw new Error(`jupiter swap failed: ${swapRes.status} ${text}`);
    }

    const swapData = await swapRes.json() as { swapTransaction: string };
    const swapTxBuf = Buffer.from(swapData.swapTransaction, "base64");
    return VersionedTransaction.deserialize(swapTxBuf);
  }
}

export { resolveMint };

// suppress unused import warning — PublicKey used by re-exporters
void PublicKey;
