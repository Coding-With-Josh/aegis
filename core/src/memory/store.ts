import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const DEFAULT_MEMORY_DIR = ".aegis/memory";

export interface DecisionEntry {
  ts: string;
  agentId: string;
  provider: string;
  action: string;
  reasoning: string;
  confidence: number;
  sig?: string;
  rejected: boolean;
  rejectionReason?: string;
  balanceLamports?: number;
}

function memPath(agentId: string, memDir: string): string {
  return join(memDir, `${agentId}.ndjson`);
}

export async function appendDecision(
  entry: DecisionEntry,
  memDir: string = DEFAULT_MEMORY_DIR
): Promise<void> {
  const path = memPath(entry.agentId, memDir);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + "\n");
}

export async function readHistory(
  agentId: string,
  limit = 20,
  memDir: string = DEFAULT_MEMORY_DIR
): Promise<DecisionEntry[]> {
  const path = memPath(agentId, memDir);
  if (!existsSync(path)) return [];
  try {
    const raw = await readFile(path, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.map((l) => JSON.parse(l) as DecisionEntry).slice(-limit);
  } catch {
    return [];
  }
}

export async function readAllHistory(
  agentIds: string[],
  limit = 100,
  memDir: string = DEFAULT_MEMORY_DIR
): Promise<DecisionEntry[]> {
  const all: DecisionEntry[] = [];
  for (const id of agentIds) {
    const entries = await readHistory(id, limit, memDir);
    all.push(...entries);
  }
  return all.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-limit);
}
