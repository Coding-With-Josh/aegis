# Aegis Deep Dive: Design, Security, and AI Integration

## Overview

Aegis is a wallet infrastructure layer designed specifically for autonomous AI agents operating on Solana. It addresses the gap between AI decision-making and secure on-chain execution by providing a modular, secure, and scalable framework for agentic wallet operations.

**Bounty alignment.** This submission satisfies the stated requirements: programmatic wallet creation, automatic signing, holding SOL and SPL tokens, interaction with a test protocol (Anchor counter), written deep dive, open-source code with README and SKILLS.md, and a working devnet prototype. It emphasizes security (encrypted key management, intent validation with allowlists and caps to mitigate prompt-injection and scam risk), clear separation between agent logic and wallet operations, and multi-agent scalability—each agent has its own wallet and executes independently.

## Architecture

Aegis implements a four-layer architecture that strictly separates concerns:

### 1. Wallet Factory Layer

**Responsibility**: Programmatic wallet creation and initialization

The Wallet Factory generates Solana keypairs for each agent, assigns them unique identifiers, and manages metadata mapping agent IDs to public keys. It handles devnet airdrops to fund agent wallets and persists agent-wallet relationships.

**Key Design Decisions**:
- Deterministic agent ID format (`agent_0`, `agent_1`, etc.)
- Metadata stored separately from encrypted keys
- Airdrop automation for devnet testing
- No shared keypairs between agents

**Implementation**: `src/wallet-factory/`
- `index.ts` - wallet creation, airdrop orchestration
- `metadata.ts` - agent-to-pubkey mapping persistence

### 2. Secure Key Management Layer

**Responsibility**: Encrypted key storage and retrieval

The keystore encrypts private keys using AES-256-GCM with a passphrase-derived key (scrypt). Keys are stored per-agent in encrypted files. The keystore API exposes `getKeypair(agentId)` which returns an in-memory keypair only to the execution layer - never to agent logic.

**Security Properties**:
- AES-256-GCM encryption (authenticated)
- Passphrase-derived keys via scrypt (resistant to brute force)
- Per-file encryption (no shared ciphertext)
- Keys only decrypted when needed for signing
- No plaintext keys in memory outside signing context

**Implementation**: `src/keystore/`
- `cipher.ts` - encryption/decryption primitives
- `index.ts` - keystore API, file I/O

**Key Isolation**: The keystore ensures agent logic cannot access keys. Only the execution layer can request keys, and only for signing specific transactions.

### 3. Agent Runtime Engine

**Responsibility**: Intent generation from agent strategies

Agents implement decision logic that produces transaction intents. Intents are structured requests like "transfer X SOL to address Y" or "call program P with accounts A, B, C". Agents never sign transactions - they only produce intents.

**Intent Types**:
- `TransferIntent` - SOL transfer to another address
- `TransferSPLIntent` - SPL token transfer (mint, recipient, amount); agents can hold and transfer tokens
- `CallProgramIntent` - invoke on-chain program with accounts and data

**Agent Types**:
- **TraderAgent**: Produces transfer intents between agents
- **LiquidityAgent**: Alternates between transfers and program calls
- **ConservativeAgent**: Only calls test program increment

**Implementation**: `src/agents/`
- `intents.ts` - intent type definitions
- `trader.ts`, `liquidity.ts`, `conservative.ts` - agent strategies
- `index.ts` - agent exports and utilities

**Extensibility**: New agents can be added by implementing intent-producing functions. The intent interface is stable, allowing AI systems to generate intents without understanding wallet internals.

### 4. Execution Layer

**Responsibility**: Intent-to-transaction conversion, signing, submission

The execution layer converts intents into Solana transactions, retrieves signing keypairs from the keystore, signs transactions, and submits them to devnet. It handles transaction construction, blockhash retrieval, and confirmation.

**Transaction Flow**:
1. Receive intent from agent
2. Build `Transaction` object with appropriate instructions
3. Request keypair from keystore (decrypted temporarily)
4. Sign transaction
5. Submit to RPC
6. Confirm with `confirmed` commitment
7. Return signature

**Implementation**: `src/execution/index.ts`

**Security**: The execution layer is the only component that ever sees decrypted keys, and only during the signing operation. Keys are not persisted in memory or logged.

## Security Considerations

### Key Exposure Risk

**Threat**: Private keys could be exposed to agent logic or logged.

**Mitigation**:
- Keys encrypted at rest with AES-256-GCM
- Keys only decrypted in execution layer during signing
- No key access API exposed to agent layer
- No key logging or plaintext storage
- Passphrase required from environment (not hardcoded)

### Agent Logic Exploitation and Prompt Injection

**Threat**: Malicious or buggy agent logic (or prompt injection / social engineering of an LLM agent) could produce harmful intents—e.g. "transfer all SOL to attacker" or "call malicious program".

**Mitigation**:
- **Intent validation before execution**: Every intent is checked against a policy before any signing. Invalid intents are rejected with a clear error; no transaction is built or sent.
- **Recipient allowlist**: SOL and SPL transfers are only allowed to known agent addresses (from metadata). Transfers to arbitrary or attacker-controlled addresses are rejected.
- **Program allowlist**: Only System Program, the test program, and any explicitly allowed program IDs can be used in `callProgram` intents. Unknown or malicious programs are rejected.
- **Transfer cap**: Max lamports per SOL transfer is configurable (`MAX_TRANSFER_LAMPORTS`, default 1 SOL). A tricked agent cannot drain the wallet in a single transfer.
- Restricted intent types (transfer, transferSpl, callProgram only); no raw transaction intent
- Devnet-only operations (no mainnet risk)
- Sandboxed execution environment

**Pattern 2: ML Inference**
- ML model predicts optimal actions, outputs intents
- Aegis handles execution
- Model training doesn't require wallet knowledge

**Pattern 3: Rule-Based Systems**
- Rules engine evaluates conditions, generates intents
- Aegis executes
- Rules can be updated without touching wallet code

**Pattern 4: External APIs**
- External service provides strategy, returns intents
- Aegis executes
- Service doesn't need Solana wallet infrastructure

### Example Integration

```typescript
// AI system produces intent
const intent = await aiSystem.decideAction(context);

// Aegis executes securely
const sig = await executeIntent(connection, agentId, intent, passphrase);
```

The AI system only needs to understand intent structure, not wallet internals or key management.

## Multi-Agent Scalability

Aegis supports multiple agents operating simultaneously with strict isolation.

### Scalability Features

- **Stateless execution**: Each transaction is independent
- **Modular agent instantiation**: Agents created on-demand
- **Configurable agent count**: CLI supports N agents
- **Parallel execution**: Agents can run concurrently (with proper RPC rate limiting)

### Isolation Guarantees

- Each agent has unique keypair
- No shared wallet state
- Independent balances
- Separate keystore files
- Metadata prevents ID conflicts

### Performance Considerations

- Keystore I/O is per-transaction (could be optimized with caching)
- RPC calls are sequential (could be parallelized)
- Encryption overhead is minimal (AES-256-GCM is fast)
- Metadata lookups are in-memory after initial load

## Test Program

The included Anchor program (`test-program/`) demonstrates agent-program interaction:

- **init_counter**: Creates a counter PDA account
- **increment**: Increments the counter value

Agents can call `increment` to prove they can interact with on-chain programs. The program uses a PDA (Program Derived Address) derived from the "counter" seed, ensuring deterministic account addresses.

## Devnet Deployment

All operations target Solana devnet:
- Safe sandbox for testing
- Free airdrops
- No real value at risk
- Fast confirmation times
- Public RPC endpoints

## Future Directions

Aegis can evolve into:

1. **Agent-Native DeFi SDK**: Pre-built intents for common DeFi operations
2. **Autonomous Hedge Fund Infrastructure**: Multi-agent portfolio management
3. **On-Chain AI Execution Protocol**: Standardized intent format for cross-platform agents
4. **Wallet Orchestration Layer**: Multi-agent economy coordination
5. **Secure AI Custody Framework**: Production-grade key management for AI systems

## Conclusion

Aegis provides a secure, modular foundation for autonomous AI agents on Solana. By separating agent logic from wallet execution, implementing robust key management, and enabling autonomous transaction signing, Aegis establishes a framework for safe AI participation in decentralized finance.

The intent-based architecture ensures that AI systems can integrate without compromising security, while the multi-agent design enables scalable autonomous economic systems. As AI agents become more prevalent in blockchain ecosystems, infrastructure like Aegis will be essential for safe, autonomous operation.

### Multi-Agent Contamination

**Threat**: Agents could interfere with each other or share state incorrectly.

**Mitigation**:
- One wallet per agent (strict isolation)
- No shared keystore state
- Independent execution contexts
- Metadata prevents agent ID collisions
- Each agent has unique keypair

### Transaction Replay and Errors

**Threat**: Stale transactions or commitment issues could cause failures.

**Mitigation**:
- Fresh blockhash retrieval for each transaction
- `confirmed` commitment level for reliable confirmation
- Explicit signature verification
- Error handling and retry logic (in production)

## AI Agent Integration

Aegis is designed to integrate with AI decision engines while maintaining security boundaries.

### Intent-Based Interface

Agents interact with Aegis through intents - structured transaction requests. This abstraction allows:
- **AI-agnostic design**: Any AI system can produce intents
- **Stable API**: Intent structure doesn't change with wallet internals
- **Security boundary**: AI never touches keys or transaction construction

### Integration Patterns

**Pattern 1: LLM-Powered Agents**
- LLM analyzes market conditions, produces transfer/call intents
- Aegis executes intents securely
- LLM never sees keys or transaction details
