import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { saveKeypair } from "../keystore/index.js";
import { saveMetadata } from "./metadata.js";
import { logInfo, logWarn } from "../logger.js";

const DEFAULT_KEYSTORE_DIR = ".aegis/keystore";
const DEFAULT_META_DIR = ".aegis/meta";
const AIRDROP_AMT = 2.5 * LAMPORTS_PER_SOL;
const AIRDROP_RETRIES = 5;
const AIRDROP_RETRY_DELAY_MS = 8000;
const AIRDROP_BETWEEN_AGENTS_MS = 12000;

export async function createWallets(
  count: number,
  passphrase: string,
  opts?: { keystoreDir?: string; metaDir?: string }
): Promise<{ agentId: string; publicKey: string }[]> {
  const keystoreDir = opts?.keystoreDir ?? DEFAULT_KEYSTORE_DIR;
  const metaDir = opts?.metaDir ?? DEFAULT_META_DIR;
  const out: { agentId: string; publicKey: string }[] = [];
  for (let i = 0; i < count; i++) {
    const agentId = `agent_${i}`;
    const kp = Keypair.generate();
    await saveKeypair(agentId, kp, passphrase, keystoreDir);
    await saveMetadata(agentId, kp.publicKey, metaDir);
    out.push({ agentId, publicKey: kp.publicKey.toBase58() });
  }
  return out;
}

export async function airdropForAgent(
  connection: Connection,
  agentId: string,
  metaDir: string = DEFAULT_META_DIR
): Promise<boolean> {
  const { getPublicKeyForAgent } = await import("./metadata.js");
  const pubkey = await getPublicKeyForAgent(agentId, metaDir);
  if (!pubkey) throw new Error(`no meta for ${agentId}`);
  for (let attempt = 1; attempt <= AIRDROP_RETRIES; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, AIRDROP_AMT);
      await connection.confirmTransaction(sig, "confirmed");
      logInfo("airdrop ok", { agentId, sol: AIRDROP_AMT / LAMPORTS_PER_SOL });
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt === AIRDROP_RETRIES) {
        logWarn("airdrop failed (all retries exhausted)", { agentId, error: msg });
        return false;
      }
      const waitMs = AIRDROP_RETRY_DELAY_MS * attempt;
      logWarn(`airdrop attempt ${attempt} failed, retrying in ${waitMs / 1000}s`, { agentId, error: msg });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return false;
}

export async function airdropAll(
  connection: Connection,
  agentIds: string[],
  metaDir: string = DEFAULT_META_DIR
): Promise<void> {
  const failed: string[] = [];
  for (let i = 0; i < agentIds.length; i++) {
    if (i > 0) {
      logInfo(`waiting ${AIRDROP_BETWEEN_AGENTS_MS / 1000}s before next airdrop (devnet rate limit)...`);
      await new Promise((r) => setTimeout(r, AIRDROP_BETWEEN_AGENTS_MS));
    }
    const ok = await airdropForAgent(connection, agentIds[i], metaDir);
    if (!ok) failed.push(agentIds[i]);
  }
  if (failed.length > 0) {
    logWarn(`airdrop failed for ${failed.length} agent(s) — run 'npm run airdrop' to retry`, {
      failed,
      hint: "set RPC_URL to a dedicated devnet endpoint to avoid rate limits",
    });
  }
}
