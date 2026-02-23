import type { ApiState, DecisionEntry, NodeAgentState, NodeTransaction } from "./types";

export async function fetchState(baseUrl: string): Promise<ApiState> {
  const res = await fetch(`${baseUrl}/api/state`, { cache: "no-store" });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  return res.json();
}

export async function fetchAgentHistory(baseUrl: string, agentId: string, limit = 50): Promise<DecisionEntry[]> {
  const res = await fetch(`${baseUrl}/api/history/${agentId}?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  const data = await res.json();
  return data.history;
}

async function fetchNodeAgent(nodeUrl: string, agentId: string): Promise<NodeAgentState> {
  const [infoRes, balRes, txRes] = await Promise.all([
    fetch(`${nodeUrl}/agents/${agentId}`, { cache: "no-store" }),
    fetch(`${nodeUrl}/agents/${agentId}/balance`, { cache: "no-store" }),
    fetch(`${nodeUrl}/agents/${agentId}/transactions?limit=20`, { cache: "no-store" }),
  ]);
  const info = await infoRes.json() as { agentId: string; publicKey: string; status: string; createdAt: string; lastActivityAt: string | null; reputationScore: number; policy: NodeAgentState["policy"] };
  const bal = await balRes.json() as { balanceSol?: number; dailySpend?: NodeAgentState["dailySpend"] };
  const txs = await txRes.json() as { transactions?: NodeTransaction[] };
  return {
    agentId: info.agentId,
    publicKey: info.publicKey,
    status: info.status,
    createdAt: info.createdAt,
    lastActivityAt: info.lastActivityAt ?? null,
    reputationScore: info.reputationScore ?? 1.0,
    policy: info.policy,
    balanceSol: bal.balanceSol ?? 0,
    dailySpend: bal.dailySpend ?? { sol: 0, usdc: 0, date: new Date().toISOString().slice(0, 10) },
    recentTxs: txs.transactions ?? [],
  };
}

export async function fetchNodeAgents(nodeUrl: string): Promise<NodeAgentState[]> {
  try {
    const res = await fetch(`${nodeUrl}/health`, { cache: "no-store" });
    if (!res.ok) return [];
    const listRes = await fetch(`${nodeUrl}/agents`, { cache: "no-store" });
    if (!listRes.ok) return [];
    const list = await listRes.json() as { agents: { id: string }[] };
    if (!Array.isArray(list.agents)) return [];
    return Promise.all(list.agents.map((a) => fetchNodeAgent(nodeUrl, a.id)));
  } catch {
    return [];
  }
}
