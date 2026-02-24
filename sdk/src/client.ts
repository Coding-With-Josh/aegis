import type {
  AegisClientOptions,
  AgentPolicy,
  USDPolicy,
  AgentInfo,
  AgentBalance,
  AgentTransaction,
  CreateAgentResult,
  ExecutionReceipt,
  Intent,
  PolicyViolation,
  CapitalLedger,
  AuditArtifact,
  PendingTransaction,
  PolicyVersion,
} from "./types.js";

export class AegisError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly violations?: PolicyViolation[]
  ) {
    super(message);
    this.name = "AegisError";
  }
}

export class AegisClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: AegisClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new AegisError(
        (data.error as string) ?? `HTTP ${res.status}`,
        res.status,
        data.violations as PolicyViolation[] | undefined
      );
    }

    return data as T;
  }

  async health(): Promise<{ status: string; ts: string; rpcEndpoint: string }> {
    return this.request("/health");
  }

  async createAgent(options?: {
    policy?: Partial<AgentPolicy>;
    usdPolicy?: USDPolicy;
    webhookUrl?: string;
    executionMode?: "autonomous" | "supervised";
  }): Promise<CreateAgentResult> {
    return this.request("/agents", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }

  async getAgents(): Promise<{ agents: Pick<AgentInfo, "agentId" | "publicKey" | "status" | "executionMode" | "createdAt" | "reputationScore">[] }> {
    return this.request("/agents");
  }

  async getAgent(agentId: string): Promise<AgentInfo> {
    return this.request(`/agents/${agentId}`);
  }

  async updateStatus(agentId: string, status: "active" | "paused" | "suspended"): Promise<{ agentId: string; status: string }> {
    return this.request(`/agents/${agentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async setExecutionMode(agentId: string, mode: "autonomous" | "supervised"): Promise<{ agentId: string; executionMode: string }> {
    return this.request(`/agents/${agentId}/execution-mode`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    });
  }

  async updateUSDPolicy(agentId: string, policy: USDPolicy): Promise<{ agentId: string; usdPolicy: USDPolicy }> {
    return this.request(`/agents/${agentId}/usd-policy`, {
      method: "PATCH",
      body: JSON.stringify(policy),
    });
  }

  async getBalance(agentId: string): Promise<AgentBalance> {
    return this.request(`/agents/${agentId}/balance`);
  }

  async getTransactions(agentId: string, limit = 50): Promise<{ agentId: string; transactions: AgentTransaction[] }> {
    return this.request(`/agents/${agentId}/transactions?limit=${limit}`);
  }

  async airdrop(agentId: string, amount = 1): Promise<{ signature: string; airdropSol: number; newBalanceSol: number }> {
    return this.request(`/agents/${agentId}/airdrop`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async execute(agentId: string, intent: Intent, reasoning?: string): Promise<ExecutionReceipt | { status: "awaiting_approval"; pendingId: string }> {
    return this.request(`/agents/${agentId}/execute`, {
      method: "POST",
      body: JSON.stringify({ intent, reasoning }),
    });
  }

  // capital / fiat

  async getCapital(agentId: string): Promise<CapitalLedger> {
    return this.request(`/agents/${agentId}/capital`);
  }

  async exportAccounting(agentId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/agents/${agentId}/capital/export`, {
      headers: this.apiKey ? { "x-api-key": this.apiKey } : {},
    });
    if (!res.ok) throw new AegisError(`HTTP ${res.status}`, res.status);
    return res.text();
  }

  async logFunding(agentId: string, params: { amountSol: number; amountUsd: number; sourceNote?: string }): Promise<{ agentId: string; recorded: boolean }> {
    return this.request(`/agents/${agentId}/funding`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // policy versions

  async getPolicyVersions(agentId: string): Promise<{ agentId: string; versions: PolicyVersion[] }> {
    return this.request(`/agents/${agentId}/policy-versions`);
  }

  // hitl pending transactions

  async getPendingTransactions(agentId: string): Promise<{ agentId: string; pending: PendingTransaction[] }> {
    return this.request(`/agents/${agentId}/pending`);
  }

  async approvePending(agentId: string, pendingId: string): Promise<PendingTransaction> {
    return this.request(`/agents/${agentId}/pending/${pendingId}/approve`, { method: "PATCH" });
  }

  async rejectPending(agentId: string, pendingId: string): Promise<PendingTransaction> {
    return this.request(`/agents/${agentId}/pending/${pendingId}/reject`, { method: "PATCH" });
  }

  // audit trail

  async getAuditLog(agentId: string, limit = 50): Promise<{ agentId: string; audit: AuditArtifact[] }> {
    return this.request(`/agents/${agentId}/audit?limit=${limit}`);
  }

  async exportAudit(agentId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/agents/${agentId}/audit/export`, {
      headers: this.apiKey ? { "x-api-key": this.apiKey } : {},
    });
    if (!res.ok) throw new AegisError(`HTTP ${res.status}`, res.status);
    return res.text();
  }
}
