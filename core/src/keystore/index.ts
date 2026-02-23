import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { encrypt, decrypt } from "./cipher.js";

const DEFAULT_KEYSTORE_DIR = ".aegis/keystore";

function keystorePath(keystoreDir: string, agentId: string): string {
  return join(keystoreDir, `agent_${agentId}.enc`);
}

export async function saveKeypair(
  agentId: string,
  keypair: Keypair,
  passphrase: string,
  keystoreDir: string = DEFAULT_KEYSTORE_DIR
): Promise<void> {
  const path = keystorePath(keystoreDir, agentId);
  await mkdir(dirname(path), { recursive: true });
  const raw = keypair.secretKey;
  const blob = encrypt(Buffer.from(raw), passphrase);
  await writeFile(path, blob);
}

export async function getKeypair(
  agentId: string,
  passphrase: string,
  keystoreDir: string = DEFAULT_KEYSTORE_DIR
): Promise<Keypair> {
  const path = keystorePath(keystoreDir, agentId);
  const blob = await readFile(path);
  const raw = decrypt(blob, passphrase);
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

export function keypairExists(agentId: string, keystoreDir: string = DEFAULT_KEYSTORE_DIR): boolean {
  return existsSync(keystorePath(keystoreDir, agentId));
}
