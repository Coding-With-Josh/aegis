# Aegis

wallet infrastructure for autonomous AI agents on Solana. agents own wallets, sign transactions, and move funds on their own. no human in the loop.

three layers:

```
aegis/
  core/   the OG engine. wallet factory, encrypted keystore, LLM agents, execution layer, CLI, API. optional USD cap and audit fields on decisions
  node/   the product. structured intent execution, policy engine, simulation, spend tracking, USD risk, capital ledger, HITL, audit trail
  sdk/    @aegis-ai/sdk. TypeScript client for the node API. typed intents, capital/audit/pending methods
  web/    Next.js dashboard. watch both layers do their thing in real time
```

## what it does

you spin up agents. each gets its own Solana keypair, encrypted and stored locally. a scheduler runs every 30s. each agent asks an LLM (Groq or OpenAI) what to do with its wallet this cycle. the LLM returns a JSON intent. aegis validates it against a policy, signs the transaction, and fires it on-chain. the agent never touches the private key.

the `node/` layer goes further. external agents (or anything with an HTTP client) send **structured intents** to the API. aegis owns the full execution path — builds the transaction, simulates it, enforces policy (including optional USD caps), signs, sends, and logs everything. agents can't sneak in hidden instructions or drain wallets. optional supervised mode queues transactions for human approve/reject. every execution is written to an audit trail. deterministic execution infrastructure, not a signing proxy.

three agent personalities in `core/` run round-robin:
- **Sentinel** paranoid capital preserver. temp 0.1, max 10% per tx, never touches programs
- **Trader** tactical executor. temp 0.5, up to 40% per tx, rebalances across peers, calls DeFi programs
- **Experimental** chaotic good. temp 0.9, tries weird micro-actions, still respects all risk rules

## running locally

### option 1: local validator (zero rate limits, instant airdrops)

```bash
solana-test-validator
```

### option 2: public devnet

just skip the validator step. airdrops are rate limited (~1 per 10s per IP) but it works.

---

**core (LLM agents):**
```bash
cd core
cp env.example .env
npm install && npm run build
npm run create-wallets -- --agents 5
npm run llm-run        # LLM scheduler, ticks every 30s
npm run serve          # monitoring API on port 5000
```

**node (intent execution server):**
```bash
cd node
cp .env.example .env   # fill in KEYSTORE_PASSPHRASE
npm install && npm run build
npm start              # intent API on port 4000
```

**web (dashboard):**
```bash
cd web
npm install
npm run dev            # localhost:3000
```

the dashboard polls `http://localhost:5000` for core agents and `http://localhost:4000` for node agents. use the connection switcher in the sidebar to toggle between local and deployed, or type in a custom URL. preference is saved across sessions.

## deployed node API

the node layer is live at:

```
https://aegis-ycdm.onrender.com
```

external agents can hit it directly:

```bash
# create an agent
curl -X POST https://aegis-ycdm.onrender.com/agents \
  -H "Content-Type: application/json" \
  -d '{}'

# fund it
curl -X POST https://aegis-ycdm.onrender.com/agents/<id>/airdrop \
  -H "Content-Type: application/json" \
  -d '{"amount": 2}'

# execute a transfer intent
curl -X POST https://aegis-ycdm.onrender.com/agents/<id>/execute \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"intent":{"type":"transfer","params":{"to":"<address>","amount":0.1,"mint":"SOL"}},"reasoning":"rebalancing"}'

# execute a swap intent (Jupiter routing)
curl -X POST https://aegis-ycdm.onrender.com/agents/<id>/execute \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"intent":{"type":"swap","params":{"fromMint":"SOL","toMint":"USDC","amount":0.5,"slippageBps":50}},"reasoning":"spread detected"}'

# stake SOL to a validator
curl -X POST https://aegis-ycdm.onrender.com/agents/<id>/execute \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"intent":{"type":"stake","params":{"amount":1,"voteAccount":"<vote_account>"}},"reasoning":"earning yield"}'

# pause an agent
curl -X PATCH https://aegis-ycdm.onrender.com/agents/<id>/status \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"status":"paused"}'

# check balance + reputation
curl https://aegis-ycdm.onrender.com/agents/<id>

# transaction history
curl https://aegis-ycdm.onrender.com/agents/<id>/transactions

# capital ledger (v3)
curl -H "x-api-key: <apiKey>" https://aegis-ycdm.onrender.com/agents/<id>/capital
curl -H "x-api-key: <apiKey>" https://aegis-ycdm.onrender.com/agents/<id>/capital/export

# log a funding event
curl -X POST https://aegis-ycdm.onrender.com/agents/<id>/funding \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"amountSol": 1, "amountUsd": 150, "sourceNote": "bank transfer"}'

# list pending (supervised mode), approve or reject
curl -H "x-api-key: <apiKey>" https://aegis-ycdm.onrender.com/agents/<id>/pending
curl -X PATCH https://aegis-ycdm.onrender.com/agents/<id>/pending/<pendingId>/approve -H "x-api-key: <apiKey>"
curl -X PATCH https://aegis-ycdm.onrender.com/agents/<id>/pending/<pendingId>/reject -H "x-api-key: <apiKey>"

# audit log and export
curl https://aegis-ycdm.onrender.com/agents/<id>/audit?limit=20
curl https://aegis-ycdm.onrender.com/agents/<id>/audit/export

# set execution mode (autonomous vs supervised)
curl -X PATCH https://aegis-ycdm.onrender.com/agents/<id>/execution-mode \
  -H "x-api-key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "supervised"}'
```

create with optional v3 options:

```bash
curl -X POST https://aegis-ycdm.onrender.com/agents \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {"maxTxAmountSOL": 1, "dailySpendLimitSOL": 5},
    "usdPolicy": {"maxTransactionUSD": 500, "maxDailyExposureUSD": 2000},
    "webhookUrl": "https://your-app.com/webhook",
    "executionMode": "autonomous"
  }'
```

save the `apiKey` from agent creation; it's shown once and stored hashed.

## structured intents

instead of raw transactions, agents send declarative intents. six types supported:

**transfer** — SOL or any SPL token
```json
{
  "type": "transfer",
  "params": { "to": "<address>", "amount": 0.5, "mint": "SOL" }
}
```

**swap** — token swaps via Jupiter routing
```json
{
  "type": "swap",
  "params": { "fromMint": "SOL", "toMint": "USDC", "amount": 1.2, "slippageBps": 50 }
}
```

**stake** — native SOL staking to a vote account
```json
{
  "type": "stake",
  "params": { "amount": 2, "voteAccount": "<vote_account_address>" }
}
```

**lend** — deposit into a lending protocol (marginfi / solend)
```json
{
  "type": "lend",
  "params": { "protocol": "marginfi", "mint": "<usdc_mint>", "amount": 100, "decimals": 6 }
}
```

**flash** — flash loan with custom instruction bundle (high risk, requires explicit policy allowance)
```json
{
  "type": "flash",
  "params": {
    "mint": "<mint>",
    "amount": 1000,
    "instructions": [{ "programId": "...", "data": "<base64>", "accounts": [] }]
  }
}
```

**cpi** — raw CPI call to any program (very high risk, requires explicit policy allowance)
```json
{
  "type": "cpi",
  "params": { "programId": "<program_id>", "data": "<base64>", "accounts": [] }
}
```

aegis handles everything else. routing, ATAs, compute budgets, simulation, signing. the agent can't manipulate the underlying instructions.

## policy engine

every agent has a policy (and optional USD policy) stored in the DB. checked before the transaction is built:

```json
{
  "allowedIntents": ["transfer", "swap"],
  "allowedMints": ["SOL", "USDC"],
  "maxTxAmountSOL": 1,
  "dailySpendLimitSOL": 5,
  "maxSlippageBps": 100,
  "requireSimulation": true,
  "cooldownMs": 5000,
  "maxRiskScore": 50
}
```

optional USD policy (separate, set on create or `PATCH /agents/:id/usd-policy`): `maxTransactionUSD`, `maxDailyExposureUSD`, `maxPortfolioExposurePercentage`, `maxDrawdownUSD`. agents can also have `executionMode`: `autonomous` (default) or `supervised`, and an optional `webhookUrl` for low-balance and pending-approval events.

checks run in order: intent type, mint, tx amount, daily spend, cooldown, risk score, slippage (swaps only), then USD rules if a USD policy is set. all violations are collected and returned together. if simulation is required and the transaction would drop the agent's SOL below 0.01 or produce a negative token delta, it's rejected before hitting the chain.

pass a custom policy when creating an agent:

```bash
curl -X POST https://aegis-ycdm.onrender.com/agents \
  -H "Content-Type: application/json" \
  -d '{"policy":{"maxTxAmountSOL":0.5,"dailySpendLimitSOL":2,"cooldownMs":10000,"maxRiskScore":40}}'
```

## reputation

every agent has a `reputationScore` starting at `1.0` (max `10.0`, min `0`):

| event | delta |
|---|---|
| confirmed transaction | +0.01 |
| policy rejection | -0.05 |
| simulation failure | -0.02 |

visible in `GET /agents/:id` and on the dashboard. agents that keep getting rejected drift toward zero.

## capital-aware layer (v3)

the node (and core where it fits) adds deterministic, treasury-style execution on top of the intent engine.

**usd risk** - all exposure is normalized to fiat. oracle layer (Pyth first, CoinGecko fallback, 30s cache) feeds a valuation engine. policies can set `maxTransactionUSD`, `maxDailyExposureUSD`, `maxPortfolioExposurePercentage`, `maxDrawdownUSD`. checked before build and after simulation. core gets `maxTransferUSD` on the execution policy and USD context in the LLM prompt.

**fiat awareness** - capital ledger tracks total injected USD, realized P&L, unrealized exposure, agent ROI. low balance below `minOperationalUSD` triggers a funding signal (and optional webhook). `POST /agents/:id/funding` logs off-chain funding events. `GET /agents/:id/capital` returns the ledger; `GET /agents/:id/capital/export` returns a CSV for accounting.

**simulation v2** - every execution path runs through the sim engine. report includes `computeUnitForecast`, `slippageActual`, `expectedDeltaViolation`, `usdImpactEstimate`. risky effects (SOL floor, negative token deltas) still reject before sign.

**policy hashing** - every policy and every intent gets a deterministic hash. transactions and audit rows store `policyHash`, `intentHash`, `policy_version`. `policy_versions` table keeps a history. proves execution under a specific governance snapshot.

**human-in-the-loop** — agents can run `autonomous` or `supervised`. in supervised mode the server builds and simulates the tx, stores it as pending, and returns `202` with a `pendingId`. you approve or reject via `PATCH /agents/:id/pending/:txId/approve` or `.../reject`. optional webhook on the agent fires when something is awaiting approval. pending rows expire after 24h; a background job marks them expired.

**audit trail** - every execution (success, reject, or fail) writes a structured artifact: `agentId`, `intent`, `intentHash`, `policyHash`, `usdRiskCheck`, `simulationResult`, `approvalState`, `finalTxSignature`, `timestamp`. `GET /agents/:id/audit` and `GET /agents/:id/audit/export` for replay and compliance. core decision entries and `/api/audit/:agentId` expose the same idea for the LLM layer.

together this turns aegis from a wallet execution layer into deterministic, capital-aware execution middleware. the SDK exposes `USDPolicy`, `getCapital`, `getAuditLog`, `exportAudit`, `getPendingTransactions`, `approvePending`, `rejectPending`, `setExecutionMode`.

## @aegis-ai/sdk

the `sdk/` package is a typed TypeScript client for the node API. no raw `fetch` calls, no guessing field names.

```typescript
import { AegisClient, transfer, swap, stake } from "@aegis-ai/sdk";

const client = new AegisClient({
  baseUrl: "https://aegis-ycdm.onrender.com",
  apiKey: "your-api-key",
});

// create an agent (optionally with USD policy, webhook, execution mode)
const { agentId, apiKey } = await client.createAgent({
  policy: { maxTxAmountSOL: 0.5, dailySpendLimitSOL: 2 },
  usdPolicy: { maxTransactionUSD: 500, maxDailyExposureUSD: 2000 },
  executionMode: "autonomous",
});

// execute intents using typed builders. returns receipt or { status: "awaiting_approval", pendingId } in supervised mode
await client.execute(agentId, transfer({ to: "<address>", amount: 0.1 }), "rebalancing");
await client.execute(agentId, swap({ fromMint: "SOL", toMint: "USDC", amount: 0.5 }), "spread detected");
await client.execute(agentId, stake({ amount: 1, voteAccount: "<vote_account>" }), "earning yield");

// read state
const balance = await client.getBalance(agentId);
const agent = await client.getAgent(agentId);   // includes reputationScore, lastActivityAt, usdPolicy, executionMode
const txs = await client.getTransactions(agentId, 20);

// capital and audit (v3)
const capital = await client.getCapital(agentId);
const csv = await client.exportAccounting(agentId);
await client.logFunding(agentId, { amountSol: 1, amountUsd: 150, sourceNote: "bank" });
const { audit } = await client.getAuditLog(agentId, 50);
const auditJson = await client.exportAudit(agentId);

// pending and execution mode (v3)
const { pending } = await client.getPendingTransactions(agentId);
await client.approvePending(agentId, pendingId);
await client.rejectPending(agentId, pendingId);
await client.setExecutionMode(agentId, "supervised");

// pause the agent
await client.updateStatus(agentId, "paused");
```

errors throw `AegisError` with a `violations` array when the policy engine rejects.

## environment variables

**core (`core/.env`):**

| variable | required | description |
|---|---|---|
| `KEYSTORE_PASSPHRASE` | yes | encrypts all agent keystores |
| `RPC_URL` | no | Solana RPC. `http://127.0.0.1:8899` for local validator, `https://api.devnet.solana.com` for devnet |
| `GROQ_API_KEY` | one of | Groq key, takes priority over OpenAI |
| `OPENAI_API_KEY` | one of | OpenAI key, used if no Groq key |
| `AEGIS_TEST_PROGRAM_ID` | no | deployed Anchor program ID. agents skip `callProgram` without this |
| `MAX_TRANSFER_LAMPORTS` | no | max lamports per transfer. defaults to 1 SOL |
| `MAX_TRANSFER_USD` | no | if set, core checks SOL transfer value in USD via CoinGecko before executing |
| `LLM_INTERVAL_MS` | no | scheduler tick interval. defaults to 30000ms |
| `API_PORT` | no | monitoring API port. defaults to 5000 |

**node (`node/.env`):**

| variable | required | description |
|---|---|---|
| `KEYSTORE_PASSPHRASE` | yes | encrypts node agent keys (AES-256-GCM) |
| `RPC_URL` | no | Solana RPC endpoint. defaults to devnet |
| `RPC_PROVIDER_URL` | no | custom RPC (Helius, Alchemy, etc). takes priority over `RPC_URL` |
| `PORT` | no | server port. defaults to 4000 |
| `DB_PATH` | no | SQLite file path. defaults to `./aegis.db` |
| `JUPITER_API_URL` | no | Jupiter quote API. defaults to `https://quote-api.jup.ag/v6` |

## resetting core agents

```bash
# wipe local state only
npm run close-wallets -- --force

# sweep remaining SOL to your wallet first
npm run close-wallets -- --drain-to <YOUR_WALLET_ADDRESS> --force

# then spin up fresh
npm run create-wallets -- --agents 3
```

removes `.aegis/keystore/`, `.aegis/meta/`, `.aegis/memory/`, `.aegis/config/`. without `--force` it asks for confirmation.
