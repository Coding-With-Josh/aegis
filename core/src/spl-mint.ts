import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const DEFAULT_META_DIR = ".aegis/meta";
const SPL_MINT_FILE = "spl-mint.json";

export async function saveSplMint(mint: string, metaDir: string = DEFAULT_META_DIR): Promise<void> {
  const path = join(metaDir, SPL_MINT_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ mint }));
}

export async function loadSplMint(metaDir: string = DEFAULT_META_DIR): Promise<string | null> {
  const path = join(metaDir, SPL_MINT_FILE);
  try {
    const raw = await readFile(path, "utf-8");
    const o = JSON.parse(raw);
    return o?.mint ?? null;
  } catch {
    return null;
  }
}
