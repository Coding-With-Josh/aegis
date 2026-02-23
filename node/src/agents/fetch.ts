import { getAgentById, type AgentRow } from "../db.js";
import type { AgentPolicy } from "../policy/types.js";

export interface AgentWithPolicy {
  row: AgentRow;
  policy: AgentPolicy;
}

export function fetchAgent(agentId: string): AgentWithPolicy {
  const row = getAgentById(agentId);
  if (!row) throw new Error(`agent not found: ${agentId}`);
  const policy = JSON.parse(row.policy_json) as AgentPolicy;
  return { row, policy };
}
