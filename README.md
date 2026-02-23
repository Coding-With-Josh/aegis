# Aegis 😝

```
aegis/
  core/   the actual engine. wallet factory, encrypted keystore, LLM agents, execution layer, CLI, API
  web/    Next.js dashboard to watch agents do their thing in real time
```

## running locally

## first run a test validator to avoid rate limiting 😭

```bash
solana-test-validator
```

**backend (core):**
```bash
cd core

cp env.example .env   # fill in KEYSTORE_PASSPHRASE and GROQ_API_KEY (or OPENAI_API_KEY)

npm install && npm run build

npm run create-wallets -- --agents 5

npm run llm-run        # starts the LLM agent scheduler

npm run serve          # starts the API server on port 5000
```

**frontend (web):**
```bash
cd web

npm install

npm run dev            # starts on port 3000
```

the dashboard polls `http://localhost:5000` by default. set `NEXT_PUBLIC_API_URL` in `web/.env.local` to change it.

## environment variables

all config lives in `core/.env`. copy `env.example` to get started.

| variable | required | description |
|---|---|---|
| `KEYSTORE_PASSPHRASE` | yes | passphrase used to encrypt all agent keystores. pick something strong |
| `RPC_URL` | no | Solana RPC endpoint. use `http://127.0.0.1:8899` for local validator, or `https://api.devnet.solana.com` for public devnet. defaults to public devnet |
| `GROQ_API_KEY` | one of these | Groq API key. takes priority over OpenAI when both are set |
| `OPENAI_API_KEY` | one of these | OpenAI API key. used if no Groq key is set |
| `AEGIS_TEST_PROGRAM_ID` | no | deployed Anchor program ID. set after `anchor deploy` in `test-program/`. without this, agents skip `callProgram` |
| `MAX_TRANSFER_LAMPORTS` | no | max lamports per transfer. defaults to 1 SOL (1000000000). caps how much a single intent can move |
| `ALLOWED_PROGRAM_IDS` | no | comma-separated extra program IDs to allow beyond system program and test program |
| `LLM_INTERVAL_MS` | no | how often agents tick in ms. defaults to 30000 (30s) |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, or `error`. defaults to `info` |
| `API_PORT` | no | port for the monitoring API. defaults to 5000 |

## resetting agents

To wipe all agent wallets and start fresh:

```bash
# wipe local state only (SOL abandoned on devnet — it's worthless)
npm run close-wallets -- --force

# or sweep remaining SOL to your own wallet first
npm run close-wallets -- --drain-to <YOUR_WALLET_ADDRESS> --force

# then create a new set
npm run create-wallets -- --agents 3
```

`close-wallets` removes `.aegis/keystore/`, `.aegis/meta/`, `.aegis/memory/`, and `.aegis/config/` — everything needed to fully reset the agent state. Without `--force` it asks for confirmation first.
