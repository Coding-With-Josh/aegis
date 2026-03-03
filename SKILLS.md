# Aegis - Skills for AI Agents

Aegis is wallet infrastructure for autonomous AI agents on Solana: programmatic wallets, automatic signing, SOL/SPL support, and multi-agent execution. This file is the top-level entry for agent tooling; layer-specific details live in the subprojects below.

## Repo layout

- **core/** - wallet factory, encrypted keystore, LLM agents, execution layer, CLI, monitoring API. Create wallets, run scripted or LLM-driven agents, SPL mint/transfer, test program interaction. See [core/SKILLS.md](core/SKILLS.md) for full commands, env vars, and security model.
- **node/** - intent execution API. External agents send structured intents (transfer, swap, stake, lend, etc.); node builds, simulates, enforces policy (including USD caps), signs, and audits. Optional HITL (supervised mode) and capital ledger. Use the node when you want HTTP-based execution instead of the core CLI.
- **web/** - Next.js dashboard. Connect to core (monitoring API) and/or node; view agents, balances, pending approvals, and audit log in real time.
- **sdk/** - `@aegis-ai/sdk`. TypeScript client for the node API: create agents, execute intents, capital/audit/pending. See [sdk/README.md](sdk/README.md).

## Quick start (core)

From repo root or `core/`:

1. `cd core && cp env.example .env` => set `KEYSTORE_PASSPHRASE` (required).
2. `npm install && npm run build`
3. `npm run create-wallets -- --agents N` => create N agent wallets (devnet).
4. `npm run spl-setup` => create SPL mint and mint to all agents.
5. `npm run run -- --agents N --rounds R` or `npm run llm-run` => run agents.

Full command reference and security policy: [core/SKILLS.md](core/SKILLS.md).

## Node API (optional)

Deployed at `https://aegis-ycdm.onrender.com` or run locally: `cd node && npm start` (port 4000). Create agents via `POST /agents`, then execute intents with `POST /agents/:id/execute` and the agent's API key. Root [README.md](README.md) documents all endpoints, intents, and policy.

## Security

Keys are encrypted (AES-256-GCM); only the execution layer signs. Intent validation (allowlists, caps, optional USD policy) runs before any transaction. Devnet-only in default config.
