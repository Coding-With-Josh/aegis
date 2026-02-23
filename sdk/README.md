# @aegis-ai/sdk

TypeScript client for the Aegis node API. Send structured intents to autonomous Solana agents — transfers, swaps, staking, lending, flash loans, and raw CPI calls — with full type safety.

## Installation

```bash
npm install @aegis-ai/sdk
```

## Quick Start

```typescript
import { AegisClient, transfer, swap, stake } from "@aegis-ai/sdk";

const client = new AegisClient({
  baseUrl: "https://aegis-ycdm.onrender.com",
  apiKey: "your-api-key",
});

// Create an agent
const { agentId, apiKey } = await client.createAgent({
  policy: { maxTxAmountSOL: 0.5, dailySpendLimitSOL: 2 },
});

// Fund it on devnet
await client.airdrop(agentId, 2);

// Execute intents
await client.execute(agentId, transfer({ to: "<address>", amount: 0.1 }), "rebalancing");
await client.execute(agentId, swap({ fromMint: "SOL", toMint: "USDC", amount: 0.5 }), "spread detected");
await client.execute(agentId, stake({ amount: 1, voteAccount: "<vote_account>" }), "earning yield");

// Read state
const agent = await client.getAgent(agentId);
const balance = await client.getBalance(agentId);
const txs = await client.getTransactions(agentId, 20);

// Pause the agent
await client.updateStatus(agentId, "paused");
```

## Intent Types

### `transfer`

Transfer SOL or any SPL token.

```typescript
import { transfer } from "@aegis-ai/sdk";

transfer({
  to: "<recipient_address>",
  amount: 0.5,
  mint: "SOL",      // optional, defaults to SOL
  decimals: 6,      // optional, defaults to 6 (used for SPL token amounts)
})
```

### `swap`

Swap tokens via Jupiter routing.

```typescript
import { swap } from "@aegis-ai/sdk";

swap({
  fromMint: "SOL",
  toMint: "USDC",
  amount: 1.0,
  slippageBps: 50,  // optional, defaults to 50
})
```

### `stake`

Delegate SOL to a validator.

```typescript
import { stake } from "@aegis-ai/sdk";

stake({
  amount: 2,
  voteAccount: "<vote_account_address>",
})
```

### `lend`

Deposit into a lending protocol.

```typescript
import { lend } from "@aegis-ai/sdk";

lend({
  protocol: "marginfi",   // "marginfi" or "solend"
  mint: "<usdc_mint>",
  amount: 100,
  decimals: 6,
})
```

### `flash`

Execute a flash loan with a custom instruction bundle. Requires `"flash"` in the agent's `allowedIntents` policy.

```typescript
import { flash } from "@aegis-ai/sdk";

flash({
  mint: "<mint_address>",
  amount: 1000,
  instructions: [
    {
      programId: "<program_id>",
      data: "<base64_encoded_data>",
      accounts: [
        { pubkey: "<address>", isSigner: false, isWritable: true },
      ],
    },
  ],
})
```

### `cpi`

Call any on-chain program directly. Requires `"cpi"` in the agent's `allowedIntents` policy.

```typescript
import { cpi } from "@aegis-ai/sdk";

cpi({
  programId: "<program_id>",
  data: "<base64_encoded_data>",
  accounts: [
    { pubkey: "<address>", isSigner: false, isWritable: true },
  ],
})
```

## Client Reference

```typescript
const client = new AegisClient({ baseUrl: string, apiKey?: string });

client.health()
// Returns: { status, ts, rpcEndpoint }

client.createAgent(options?)
// options.policy: Partial<AgentPolicy>
// Returns: { agentId, publicKey, apiKey, note }

client.getAgents()
// Returns: { agents: AgentSummary[] }

client.getAgent(agentId)
// Returns: AgentInfo (includes policy, reputationScore, lastActivityAt)

client.updateStatus(agentId, status)
// status: "active" | "paused" | "suspended"
// Requires apiKey

client.getBalance(agentId)
// Returns: { balanceSol, balanceLamports, dailySpend }

client.getTransactions(agentId, limit?)
// Returns: { agentId, transactions: AgentTransaction[] }

client.airdrop(agentId, amount?)
// Devnet only. amount defaults to 1 SOL, max 5 SOL

client.execute(agentId, intent, reasoning?)
// Requires apiKey
// Returns: ExecutionReceipt
```

## Policy

Every agent enforces a policy on every intent before anything touches the chain. Policy is set at agent creation and stored server-side.

```typescript
await client.createAgent({
  policy: {
    allowedIntents: ["transfer", "swap"],
    allowedMints: ["SOL", "USDC"],
    maxTxAmountSOL: 1,
    dailySpendLimitSOL: 5,
    maxSlippageBps: 100,
    requireSimulation: true,
    cooldownMs: 5000,
    maxRiskScore: 50,
  },
});
```

Checks run in order: intent type, mint allowlist, transaction amount cap, daily spend limit, cooldown window, risk score, and slippage (swaps only). All violations are collected and returned together rather than failing on the first one.

If `requireSimulation` is true, the transaction is simulated before signing. Execution is blocked if the simulation would drop the agent's SOL below 0.01 or produce an unexpected negative token delta.

## Reputation

Each agent has a `reputationScore` starting at `1.0`. It increases on successful transactions and decreases on policy rejections or simulation failures. Visible in `getAgent()`.

## Error Handling

Policy violations and API errors throw `AegisError`.

```typescript
import { AegisClient, AegisError, transfer } from "@aegis-ai/sdk";

try {
  await client.execute(agentId, transfer({ to: "...", amount: 999 }));
} catch (e) {
  if (e instanceof AegisError) {
    console.log(e.status);      // 403
    console.log(e.message);     // "[AMOUNT_EXCEEDS_TX_CAP] amount 999 SOL exceeds maxTxAmountSOL 1"
    console.log(e.violations);  // [{ code: "AMOUNT_EXCEEDS_TX_CAP", message: "..." }]
  }
}
```

## License

MIT
