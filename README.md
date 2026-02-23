# Aegis

wallet infrastructure for autonomous AI agents on Solana. agents own wallets, sign transactions, and move funds on their own. no human in the loop.

two layers:

```
aegis/
  core/   the OG engine. wallet factory, encrypted keystore, LLM agents, execution layer, CLI, API
  node/   the product. structured intent execution infrastructure. policy engine, simulation, spend tracking
  web/    Next.js dashboard. watch both layers do their thing in real time
```

## what it does

you spin up agents. each gets its own Solana keypair, encrypted and stored locally. a scheduler runs every 30s. each agent asks an LLM (Groq or OpenAI) what to do with its wallet this cycle. the LLM returns a JSON intent. aegis validates it against a policy, signs the transaction, and fires it on-chain. the agent never touches the private key.

the `node/` layer goes further. external agents (or anything with an HTTP client) send **structured intents** to the API. aegis owns the full execution path — builds the transaction, simulates it, enforces policy, signs, sends, and logs everything. agents can't sneak in hidden instructions or drain wallets. it's deterministic execution infrastructure, not a signing proxy.

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

the dashboard polls `http://localhost:5000` for core agents and `http://localhost:4000` for node agents. set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_NODE_API_URL` in `web/.env.local` to override.

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

# check balance
curl https://aegis-ycdm.onrender.com/agents/<id>/balance

# transaction history
curl https://aegis-ycdm.onrender.com/agents/<id>/transactions
```

save the `apiKey` from agent creation — it's shown once and stored hashed.

## structured intents

instead of raw transactions, agents send declarative intents:

```json
{
  "type": "transfer",
  "params": {
    "to": "wallet_address",
    "amount": 0.5,
    "mint": "SOL"
  },
  "reasoning": "rebalancing capital"
}
```

```json
{
  "type": "swap",
  "params": {
    "fromMint": "SOL",
    "toMint": "USDC",
    "amount": 1.2,
    "slippageBps": 50
  },
  "reasoning": "spread detected on DEX"
}
```

aegis handles everything else. routing, ATAs, compute budgets, simulation, signing. the agent can't manipulate the underlying instructions.

## policy engine

every agent has a policy stored in the DB. checked before the transaction is built:

```json
{
  "allowedIntents": ["swap", "transfer"],
  "allowedMints": ["SOL", "USDC"],
  "maxTxAmountSOL": 1,
  "dailySpendLimitSOL": 5,
  "maxSlippageBps": 100,
  "requireSimulation": true
}
```

pass a custom policy when creating an agent:

```bash
curl -X POST https://aegis-ycdm.onrender.com/agents \
  -H "Content-Type: application/json" \
  -d '{"policy":{"maxTxAmountSOL":0.5,"dailySpendLimitSOL":2}}'
```

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
| `LLM_INTERVAL_MS` | no | scheduler tick interval. defaults to 30000ms |
| `API_PORT` | no | monitoring API port. defaults to 5000 |

**node (`node/.env`):**

| variable | required | description |
|---|---|---|
| `KEYSTORE_PASSPHRASE` | yes | encrypts node agent keys (AES-256-GCM) |
| `RPC_URL` | no | Solana RPC endpoint. defaults to devnet |
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
