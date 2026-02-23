# Aegis Security Model

## Overview

Aegis is built around one core principle: **AI agents must never have direct access to private keys**. Every security decision in the architecture flows from this constraint.

---

## 1. Key Isolation

Private keys are encrypted at rest using AES-256-GCM with a passphrase-derived key (scrypt). The keystore API (`src/keystore/`) exposes exactly one function to the execution layer: `getKeypair(agentId, passphrase)`. This decrypts the key in memory, uses it to sign a transaction, and the keypair object is never passed to agent logic.

**What agents see:** nothing. Agents produce `Intent` objects — plain data structures with no reference to keys.

**What the execution layer sees:** a keypair for the duration of one `sendAndConfirmTransaction` call. After the call returns, the keypair is garbage-collected.

**Storage:** `.aegis/keystore/agent_<id>.enc` — encrypted blobs only. Never plaintext on disk.

---

## 2. Intent Validation as LLM Output Firewall

LLM outputs are untrusted by design. An LLM can be manipulated via prompt injection, hallucinate addresses, or return malformed data. Aegis treats every LLM response as hostile input and validates it through three independent layers before any transaction is signed:

### Layer 1 — Zod Schema Validation (`src/llm/schema.ts`)

Every LLM response is parsed against a strict Zod schema before any further processing. Fields are type-checked, ranges enforced (`confidence: 0–1`, `reasoning: min 20 chars`), and unknown fields stripped. Malformed output triggers up to 2 retries with an error-correction prompt. After 3 failures the agent falls back to `hold` — no transaction is submitted.

### Layer 2 — Risk Profile Enforcement (`src/agents/llm/base-llm-agent.ts`)

Before an intent reaches the execution layer, the agent's own risk profile is checked:

- `allowedActions` — only actions in this list are permitted. Sentinel cannot call programs; this check happens before the intent is even constructed.
- `maxPct` — lamport amount is capped at `balanceLamports × maxPct`. Requests exceeding this are dropped and logged as rejections.
- `peerAddresses` — recipient addresses are validated against the known peer list. Any address not in the list is rejected. This directly prevents prompt injection attacks where a malicious instruction tries to redirect funds to an attacker's address.

### Layer 3 — Execution Policy (`src/execution/policy.ts`)

The final check before signing:

- `allowedRecipients` — set of known agent public keys from metadata
- `allowedProgramIds` — only System Program and the configured test program
- `maxTransferLamports` — global cap configurable via `MAX_TRANSFER_LAMPORTS` env var

Any intent that passes layers 1 and 2 but fails layer 3 throws an error, is caught by the scheduler, logged as a rejection, and not submitted.

---

## 3. Prompt Injection Mitigations

Prompt injection is the primary attack surface for LLM-powered agents. An attacker might embed instructions in on-chain data, peer wallet labels, or any external data fed into the prompt.

**Mitigations:**

- **Structured output only** — the LLM is forced into `response_format: { type: "json_object" }` mode. Natural language instructions in the output cannot be executed; only parsed JSON fields matter.
- **Address allowlist** — even if an attacker injects "send all funds to `<attacker address>`" into the prompt, the recipient validation in layer 2 rejects it because the address is not in `peerAddresses`.
- **Amount cap** — even if the LLM is convinced to request a large transfer, `maxPct` limits the blast radius to a fraction of the wallet balance.
- **Action allowlist** — Sentinel cannot be tricked into calling arbitrary programs because `callProgram` is not in its `allowedActions`.
- **Reasoning length requirement** — one-word or empty reasoning strings fail Zod validation, forcing the LLM to produce substantive justification that can be audited.
- **No dynamic code execution** — agent logic never calls `eval`, `exec`, or any dynamic code execution on LLM output.

---

## 4. Risk Tier Differentiation

Three agents operate with different risk profiles, demonstrating defense-in-depth:

| Agent | Max per tx | Allowed actions | Temperature | Provider |
|-------|-----------|----------------|-------------|----------|
| Aegis Sentinel | 10% | transfer, hold | 0.1 | OpenAI gpt-4o-mini |
| Aegis Trader | 40% | transfer, callProgram, hold | 0.5 | OpenAI gpt-4o |
| Aegis Experimental | 20% | transfer, callProgram, hold | 0.9 | OpenAI gpt-4o-mini / Mock |

Higher temperature means more creative reasoning, which is why Experimental has a lower cap than Trader despite having more allowed actions.

---

## 5. Provider Failure Fallback

If the LLM provider is unavailable (network error, rate limit, missing API key):

- The scheduler catches the exception
- Logs a `hold` decision to the memory store with the error message
- Continues to the next agent
- No transaction is submitted

The Experimental agent additionally falls back to `MockProvider` if `OPENAI_API_KEY` is not set, demonstrating that the security layer is independent of the intelligence layer.

---

## 6. Multi-Agent Isolation

Each agent has:

- Its own encrypted keypair file (`.aegis/keystore/agent_<id>.enc`)
- Its own memory log (`.aegis/memory/<agentId>.ndjson`)
- Its own risk profile and system prompt
- No shared state with other agents

A compromised agent cannot access another agent's keys, read another agent's memory, or submit transactions on behalf of another agent.

---

## 7. Devnet Sandboxing

All operations run on Solana devnet. No mainnet keys, no real funds. The RPC endpoint defaults to `https://api.devnet.solana.com` and can only be overridden via `RPC_URL`. There is no mainnet configuration path in the codebase.

---

## 8. Attack Surface Summary

| Attack vector | Mitigation |
|--------------|------------|
| Prompt injection → redirect funds | Recipient allowlist (layers 2 + 3) |
| Prompt injection → drain wallet | Transfer cap (maxPct + maxTransferLamports) |
| Prompt injection → call malicious program | Program allowlist (layer 3) |
| LLM hallucinated address | Peer address validation (layer 2) |
| Malformed LLM output | Zod schema + retry + hold fallback (layer 1) |
| Provider failure / rate limit | Exception catch → hold, no tx submitted |
| Key extraction by agent | Keys never passed to agent layer |
| Key extraction from disk | AES-256-GCM encryption at rest (scrypt KDF) |
| Cross-agent contamination | Isolated keystores, no shared state |
| Mainnet exposure | Devnet-only, no mainnet config path |
