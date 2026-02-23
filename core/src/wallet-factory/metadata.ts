import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_META_DIR = ".aegis/meta";

export interface AgentMeta {
  agentId: string;
  publicKey: string;
}

export async function saveMetadata(agentId: string, publicKey: PublicKey, metaDir: string = DEFAULT_META_DIR): Promise<void> {
  const path = join(metaDir, "agents.json");
  await mkdir(dirname(path), { recursive: true });
  let list: AgentMeta[] = [];
  try {
    const raw = await readFile(path, "utf-8");
    list = JSON.parse(raw);
  } catch { /* new file */ }
  const idx = list.findIndex((m) => m.agentId === agentId);
  const entry: AgentMeta = { agentId, publicKey: publicKey.toBase58() };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  await writeFile(path, JSON.stringify(list, null, 0));
}

export async function loadMetadata(metaDir: string = DEFAULT_META_DIR): Promise<AgentMeta[]> {
  const path = join(metaDir, "agents.json");
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function getPublicKeyForAgent(agentId: string, metaDir: string = DEFAULT_META_DIR): Promise<PublicKey | null> {
  const list = await loadMetadata(metaDir);
  const m = list.find((x) => x.agentId === agentId);
  return m ? new PublicKey(m.publicKey) : null;
}
