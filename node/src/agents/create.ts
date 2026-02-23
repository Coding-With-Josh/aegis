import { Keypair } from "@solana/web3.js";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { insertAgent } from "../db.js";
import { generateApiKey, hashApiKey } from "../auth.js";
import type { AgentPolicy } from "../policy/types.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT_LEN = 32;

const PASSPHRASE = process.env.KEYSTORE_PASSPHRASE ?? "";

function encryptKey(plain: Buffer): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = scryptSync(PASSPHRASE, salt, KEY_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]).toString("base64");
}

export function decryptKey(blob64: string): Buffer {
  const blob = Buffer.from(blob64, "base64");
  const salt = blob.subarray(0, SALT_LEN);
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const enc = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = scryptSync(PASSPHRASE, salt, KEY_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function getKeypairForAgent(encryptedKey: string): Keypair {
  const secretKey = decryptKey(encryptedKey);
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

const DEFAULT_POLICY: AgentPolicy = {
  allowedIntents: ["transfer", "swap"],
  allowedMints: ["SOL", "USDC"],
  maxTxAmountSOL: 1,
  dailySpendLimitSOL: 5,
  maxSlippageBps: 100,
  requireSimulation: true,
};

export interface CreateAgentResult {
  agentId: string;
  publicKey: string;
  apiKey: string;
}

export async function createAgent(policy?: Partial<AgentPolicy>): Promise<CreateAgentResult> {
  if (!PASSPHRASE) throw new Error("KEYSTORE_PASSPHRASE not set");

  const keypair = Keypair.generate();
  const encryptedKey = encryptKey(Buffer.from(keypair.secretKey));
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const agentId = uuidv4();

  const mergedPolicy: AgentPolicy = { ...DEFAULT_POLICY, ...policy };

  insertAgent({
    id: agentId,
    public_key: keypair.publicKey.toBase58(),
    encrypted_private_key: encryptedKey,
    api_key_hash: apiKeyHash,
    policy_json: JSON.stringify(mergedPolicy),
    status: "active",
    created_at: new Date().toISOString(),
  });

  return { agentId, publicKey: keypair.publicKey.toBase58(), apiKey };
}
