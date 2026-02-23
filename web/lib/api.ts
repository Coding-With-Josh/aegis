import type { ApiState, DecisionEntry, NodeAgentState, NodeTransaction } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const NODE_BASE = process.env.NEXT_PUBLIC_NODE_API_URL ?? "http://localhost:4000";

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

async function fetchNodeAgent(agentId: string): Promise<NodeAgentState> {
  const [infoRes, balRes, txRes] = await Promise.all([
    fetch(`${NODE_BASE}/agents/${agentId}`, { cache: "no-store" }),
    fetch(`${NODE_BASE}/agents/${agentId}/balance`, { cache: "no-store" }),
    fetch(`${NODE_BASE}/agents/${agentId}/transactions?limit=20`, { cache: "no-store" }),
  ]);
  const info = await infoRes.json() as { agentId: string; publicKey: string; status: string; createdAt: string; policy: NodeAgentState["policy"] };
  const bal = await balRes.json() as { balanceSol: number; dailySpend: NodeAgentState["dailySpend"] };
  const txs = await txRes.json() as { transactions: NodeTransaction[] };
  return {
    agentId: info.agentId,
    publicKey: info.publicKey,
    status: info.status,
    createdAt: info.createdAt,
    policy: info.policy,
    balanceSol: bal.balanceSol,
    dailySpend: bal.dailySpend,
    recentTxs: txs.transactions,
  };
}

export async function fetchNodeAgents(): Promise<NodeAgentState[]> {
  try {
    const res = await fetch(`${NODE_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return [];
    const listRes = await fetch(`${NODE_BASE}/agents`, { cache: "no-store" });
    if (!listRes.ok) return [];
    const list = await listRes.json() as { agents: { id: string }[] };
    if (!Array.isArray(list.agents)) return [];
    return Promise.all(list.agents.map((a) => fetchNodeAgent(a.id)));
  } catch {
    return [];
  }
}
