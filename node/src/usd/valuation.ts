import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getPriceUSDSafe } from "../oracle/index.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

// converts a token amount to its USD equivalent using the oracle
export async function toUSD(amount: number, mint: string): Promise<number> {
  if (amount === 0) return 0;
  const price = await getPriceUSDSafe(mint === "SOL" ? SOL_MINT : mint);
  return amount * price;
}

// returns the total USD value of the agent's on-chain SOL balance
export async function getPortfolioUSD(agentPublicKey: string, connection: Connection): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(agentPublicKey), "confirmed");
    const sol = lamports / LAMPORTS_PER_SOL;
    return toUSD(sol, SOL_MINT);
  } catch {
    return 0;
  }
}
