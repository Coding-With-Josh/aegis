import type { OracleAdapter } from "./adapter.js";
import { PythOracle } from "./pyth.js";
import { CoinGeckoOracle } from "./coingecko.js";

export type { OracleAdapter };

interface CacheEntry {
  price: number;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

const pyth = new PythOracle();
const coingecko = new CoinGeckoOracle();

// stablecoins priced at exactly 1 — no oracle call needed
const STABLE_MINTS = new Set([
  "USDC",
  "USDT",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

export async function getPriceUSD(mint: string): Promise<number> {
  if (STABLE_MINTS.has(mint) || STABLE_MINTS.has(mint.toUpperCase())) return 1.0;

  const cached = cache.get(mint);
  if (cached && Date.now() < cached.expiresAt) return cached.price;

  let price: number;
  try {
    price = await pyth.getPriceUSD(mint);
  } catch {
    // pyth failed, fall back to coingecko
    price = await coingecko.getPriceUSD(mint);
  }

  cache.set(mint, { price, expiresAt: Date.now() + CACHE_TTL_MS });
  return price;
}

// returns 0 if the mint has no known price feed, never throws
export async function getPriceUSDSafe(mint: string): Promise<number> {
  try {
    return await getPriceUSD(mint);
  } catch {
    return 0;
  }
}
