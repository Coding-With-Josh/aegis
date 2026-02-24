import type { OracleAdapter } from "./adapter.js";

// pyth price feed ids for common assets on devnet/mainnet
const PYTH_FEED_IDS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  SOL: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

const HERMES = "https://hermes.pyth.network/v2/updates/price/latest";

export class PythOracle implements OracleAdapter {
  async getPriceUSD(mint: string): Promise<number> {
    const feedId = PYTH_FEED_IDS[mint.toUpperCase()] ?? PYTH_FEED_IDS[mint];
    if (!feedId) throw new Error(`no pyth feed for mint: ${mint}`);

    const url = `${HERMES}?ids[]=${feedId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`pyth request failed: ${res.status}`);

    const data = await res.json() as {
      parsed: { price: { price: string; expo: number } }[];
    };

    const parsed = data.parsed?.[0];
    if (!parsed) throw new Error("pyth returned no price data");

    const price = Number(parsed.price.price);
    const expo = parsed.price.expo;
    return price * Math.pow(10, expo);
  }
}
