# Aegis - Skills for AI Agents

Aegis is a wallet infrastructure layer for autonomous AI agents on Solana. It enables agents to create wallets, sign transactions, hold SOL, and interact with protocols without human intervention.

## What Aegis Does

Aegis provides secure wallet operations for AI agents:
- creates Solana wallets programmatically
- stores encrypted private keys
- signs transactions automatically
- supports multiple agents with isolated wallets
- executes agent intents (transfer SOL, transfer SPL tokens, call programs)

## How It Works

Agents produce **intents** (transaction requests) but never touch private keys. The execution layer signs and submits transactions automatically.

Example intents:
- transfer X SOL to address Y
- call program P with accounts A, B, C

## Setup

1. install: `npm install`
2. configure: copy `env.example` to `.env`, set `KEYSTORE_PASSPHRASE`
3. build: `npm run build`

## Commands

- `npm run create-wallets -- --agents N` - create N agent wallets, airdrop SOL
- `npm run run -- --agents N --rounds R` - run N agents for R rounds
- `npm run balance` - show SOL balances per agent
- `npm run init-test-program` - initialize test program counter (after deploy)
- `npm run init-trades` - initialize DeFi trade state (after deploy, for scripted trades)
- `npm run spl-setup` - create SPL mint and mint tokens to agent_0 (hold SPL)
- `npm run spl-transfer` - transfer SPL between agents
- `npm run demo` - run 2 rounds + balance

## Environment Variables

- `KEYSTORE_PASSPHRASE` (required) - encryption passphrase
- `RPC_URL` (optional) - Solana RPC, defaults to devnet
- `AEGIS_TEST_PROGRAM_ID` (optional) - test program ID
- `MAX_TRANSFER_LAMPORTS` (optional) - max lamports per transfer (default 1e9). Reduces scam / prompt-injection impact.
- `ALLOWED_PROGRAM_IDS` (optional) - comma-separated extra program IDs allowed besides system + test program

## Security policy (intent validation)

Before any intent is signed, the execution layer checks:
- **Transfers** only to known agent addresses (allowlist from metadata); amount ≤ `MAX_TRANSFER_LAMPORTS`.
- **Program calls** only to allowed programs (system, test program, and `ALLOWED_PROGRAM_IDS`).
Invalid intents are rejected with a clear error so agents cannot be tricked into sending to strangers or calling malicious programs.

## Agent Types

- **TraderAgent** - transfers SOL between agents
- **LiquidityAgent** - alternates transfers and program calls
- **ConservativeAgent** - calls test program increment only
- **DeFiTraderAgent** - executes scripted trades (`trade(amount)`) on the test DeFi protocol

## Intent-Based Architecture

Agents emit intents, execution layer handles signing:
1. agent logic produces intent
2. execution builds transaction from intent
3. keystore provides signing keypair
4. transaction signed and submitted
5. agent never sees private key

## Multi-Agent Support

Each agent has its own wallet:
- agent_0, agent_1, agent_2, etc.
- isolated balances
- independent execution
- no shared keys

## Test Program

Minimal Anchor counter program in `test-program/`. Deploy to devnet, set program ID in env, run `init-test-program` once, then agents can increment it.

## Security Model

- keys encrypted at rest (AES-256-GCM)
- keys only decrypted for signing
- agent layer has no key access
- devnet-only (safe sandbox)
- one wallet per agent

## Integration

Aegis is designed to integrate with AI decision engines. Replace scripted agent logic with:
- LLM-powered strategies
- ML inference
- rule-based systems
- external APIs

The intent interface remains the same - agents produce intents, Aegis executes them securely.
