import type { ApiState, DecisionEntry } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function fetchState(): Promise<ApiState> {
  const res = await fetch(`${BASE}/api/state`, { cache: "no-store" });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  return res.json();
}

export async function fetchAgentHistory(agentId: string, limit = 50): Promise<DecisionEntry[]> {
  const res = await fetch(`${BASE}/api/history/${agentId}?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  const data = await res.json();
  return data.history;
}
