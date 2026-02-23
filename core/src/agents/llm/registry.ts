import { SentinelAgent } from "./sentinel.js";
import { TraderAgent } from "./trader.js";
import { ExperimentalAgent } from "./experimental.js";
import type { BaseLLMAgent } from "./base-llm-agent.js";

export interface LLMAgentEntry {
  agentId: string;
  agent: BaseLLMAgent;
}

export function buildLLMRegistry(
  agentIds: string[],
  memoryDir?: string
): LLMAgentEntry[] {
  const factories: ((id: string) => BaseLLMAgent)[] = [
    (id) => new SentinelAgent({ agentId: id, memoryDir }),
    (id) => new TraderAgent({ agentId: id, memoryDir }),
    (id) => new ExperimentalAgent({ agentId: id, memoryDir }),
  ];

  // cycles sentinel, trader, experimental, sentinel, ... for any number of agents
  return agentIds.map((id, i) => ({
    agentId: id,
    agent: factories[i % factories.length](id),
  }));
}

export type { BaseLLMAgent };
