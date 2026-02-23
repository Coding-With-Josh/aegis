import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type AgentStrategy = "trader" | "liquidity" | "conservative" | "defiTrader";

export interface AgentConfig {
  strategy?: AgentStrategy;
  maxLamports?: number;
  rounds?: number;
}

const DEFAULT_CONFIG_DIR = ".aegis/config";

export async function loadAgentConfig(
  agentId: string,
  configDir: string = DEFAULT_CONFIG_DIR
): Promise<AgentConfig> {
  const path = join(configDir, `${agentId}.json`);
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as AgentConfig;
  } catch {
    return {};
  }
}

export async function saveAgentConfig(
  agentId: string,
  config: AgentConfig,
  configDir: string = DEFAULT_CONFIG_DIR
): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const path = join(configDir, `${agentId}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2));
}
