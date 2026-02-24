import type { OracleAdapter } from "./adapter.js";

// coingecko coin ids by mint address or symbol
const CG_IDS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "solana",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usd-coin",
  SOL: "solana",
  USDC: "usd-coin",
};

const CG_BASE = "https://api.coingecko.com/api/v3";

export class CoinGeckoOracle implements OracleAdapter {
  async getPriceUSD(mint: string): Promise<number> {
    const coinId = CG_IDS[mint.toUpperCase()] ?? CG_IDS[mint];
    if (!coinId) throw new Error(`no coingecko id for mint: ${mint}`);

    const url = `${CG_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`coingecko request failed: ${res.status}`);

    const data = await res.json() as Record<string, { usd: number }>;
    const price = data[coinId]?.usd;
    if (price === undefined) throw new Error(`coingecko returned no price for ${coinId}`);
    return price;
  }
}
