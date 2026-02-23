import type {
  AegisClientOptions,
  AgentPolicy,
  AgentInfo,
  AgentBalance,
  AgentTransaction,
  CreateAgentResult,
  ExecutionReceipt,
  Intent,
  PolicyViolation,
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

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

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

  async createAgent(options?: { policy?: Partial<AgentPolicy> }): Promise<CreateAgentResult> {
    return this.request("/agents", {
      method: "POST",
      body: JSON.stringify({ policy: options?.policy }),
    });
  }

  async getAgents(): Promise<{ agents: Pick<AgentInfo, "agentId" | "publicKey" | "status" | "createdAt" | "reputationScore">[] }> {
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

  async execute(agentId: string, intent: Intent, reasoning?: string): Promise<ExecutionReceipt> {
    return this.request(`/agents/${agentId}/execute`, {
      method: "POST",
      body: JSON.stringify({ intent, reasoning }),
    });
  }
}
