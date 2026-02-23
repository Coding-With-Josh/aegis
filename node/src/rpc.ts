import { Connection } from "@solana/web3.js";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const url =
      process.env.RPC_PROVIDER_URL ??
      process.env.RPC_URL ??
      "https://api.devnet.solana.com";
    _connection = new Connection(url, "confirmed");
  }
  return _connection;
}

export function getRpcEndpointHost(): string {
  const url =
    process.env.RPC_PROVIDER_URL ??
    process.env.RPC_URL ??
    "https://api.devnet.solana.com";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
