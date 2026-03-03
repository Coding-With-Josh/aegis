import type {
  ApiState,
  DecisionEntry,
  NodeAgentState,
  NodeTransaction,
  PendingTxSummary,
  AuditEntry,
} from "./types";

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

export async function fetchPending(nodeUrl: string, agentId: string): Promise<PendingTxSummary[]> {
  const res = await fetch(`${nodeUrl}/agents/${agentId}/pending`, { cache: "no-store" });
  if (!res.ok) throw new Error(`pending error ${res.status}`);
  const data = (await res.json()) as { agentId: string; pending: PendingTxSummary[] };
  return data.pending ?? [];
}

export async function approvePending(
  nodeUrl: string,
  agentId: string,
  txId: string,
  apiKey: string
): Promise<PendingTxSummary> {
  const res = await fetch(`${nodeUrl}/agents/${agentId}/pending/${txId}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? `approve failed ${res.status}`);
  }
  return res.json();
}

export async function rejectPending(
  nodeUrl: string,
  agentId: string,
  txId: string,
  apiKey: string
): Promise<PendingTxSummary> {
  const res = await fetch(`${nodeUrl}/agents/${agentId}/pending/${txId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? `reject failed ${res.status}`);
  }
  return res.json();
}

export async function fetchAuditLog(
  nodeUrl: string,
  agentId: string,
  limit = 50
): Promise<AuditEntry[]> {
  const res = await fetch(`${nodeUrl}/agents/${agentId}/audit?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`audit error ${res.status}`);
  const data = (await res.json()) as { agentId: string; audit: AuditEntry[] };
  return data.audit ?? [];
}

async function fetchNodeAgent(nodeUrl: string, agentId: string): Promise<NodeAgentState> {
  const [infoRes, balRes, txRes, pendingRes] = await Promise.all([
    fetch(`${nodeUrl}/agents/${agentId}`, { cache: "no-store" }),
    fetch(`${nodeUrl}/agents/${agentId}/balance`, { cache: "no-store" }),
    fetch(`${nodeUrl}/agents/${agentId}/transactions?limit=20`, { cache: "no-store" }),
    fetch(`${nodeUrl}/agents/${agentId}/pending`, { cache: "no-store" }),
  ]);
  const info = (await infoRes.json()) as {
    agentId: string;
    publicKey: string;
    status: string;
    executionMode?: string;
    createdAt: string;
    lastActivityAt: string | null;
    reputationScore: number;
    policy: NodeAgentState["policy"];
  };
  const bal = (await balRes.json()) as { balanceSol?: number; dailySpend?: NodeAgentState["dailySpend"] };
  const txs = (await txRes.json()) as { transactions?: NodeTransaction[] };
  const pendingData = (await pendingRes.json()) as { agentId: string; pending: PendingTxSummary[] };
  return {
    agentId: info.agentId,
    publicKey: info.publicKey,
    status: info.status,
    executionMode: info.executionMode,
    createdAt: info.createdAt,
    lastActivityAt: info.lastActivityAt ?? null,
    reputationScore: info.reputationScore ?? 1.0,
    policy: info.policy,
    balanceSol: bal.balanceSol ?? 0,
    dailySpend: bal.dailySpend ?? { sol: 0, usdc: 0, date: new Date().toISOString().slice(0, 10) },
    recentTxs: txs.transactions ?? [],
    pending: pendingData.pending ?? [],
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
