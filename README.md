# Aegis 😝

```
aegis/
  core/   the actual engine. wallet factory, encrypted keystore, LLM agents, execution layer, CLI, API
  web/    Next.js dashboard to watch agents do their thing in real time
```

## running locally

**backend (core):**
```bash
cd core

cp env.example .env   # fill in KEYSTORE_PASSPHRASE and GROQ_API_KEY (or OPENAI_API_KEY)

npm install && npm run build

npm run create-wallets -- --agents 3

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
