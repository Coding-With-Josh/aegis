import "dotenv/config";
import { program, Option } from "commander";
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, createAssociatedTokenAccountIdempotent, mintTo, getAccount } from "@solana/spl-token";
import { createWallets, airdropAll } from "./wallet-factory/index.js";
import { loadMetadata } from "./wallet-factory/metadata.js";
import { executeIntent, defaultPolicy, buildDefaultAllowedPrograms } from "./execution/index.js";
import {
  TraderAgent, LiquidityAgent, ConservativeAgent, DeFiTraderAgent,
  peerPubkeysFromMeta, AGENT_CLASSES, loadAgentConfig,
} from "./agents/index.js";
import type { AgentStrategy } from "./agents/index.js";
import { buildInitCounterIntent, buildInitTradesIntent, AEGIS_TEST_PROGRAM_ID } from "./test-program-client.js";
import { readFileSync, existsSync } from "node:fs";
import { rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { keypairExists, getKeypair } from "./keystore/index.js";
import { saveSplMint, loadSplMint } from "./spl-mint.js";
import { logInfo, logWarn, logError, logDebug } from "./logger.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PASSPHRASE = process.env.KEYSTORE_PASSPHRASE ?? "";
const META_DIR = ".aegis/meta";
const KEYSTORE_DIR = ".aegis/keystore";
const CONFIG_DIR = ".aegis/config";

function conn(): Connection {
  return new Connection(RPC);
}

// functional agent map for fallback (no per-agent config)
const FUNCTIONAL_AGENTS = [TraderAgent, LiquidityAgent, ConservativeAgent, DeFiTraderAgent] as const;

const STRATEGY_MAP: Record<AgentStrategy, typeof FUNCTIONAL_AGENTS[number]> = {
  trader: TraderAgent,
  liquidity: LiquidityAgent,
  conservative: ConservativeAgent,
  defiTrader: DeFiTraderAgent,
};

program
  .name("aegis")
  .description("agentic wallet infra for ai agents on solana")
  .version("1.0.0");

program
  .command("program-id")
  .description("print test program id from keypair (for AEGIS_TEST_PROGRAM_ID in .env)")
  .action(() => {
    const path = join(process.cwd(), "test-program", "target", "deploy", "aegis_test-keypair.json");
    if (!existsSync(path)) {
      logError("keypair not found", { hint: "cd test-program && anchor build" });
      process.exit(1);
    }
    const raw = readFileSync(path, "utf-8");
    const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
    process.stdout.write(kp.publicKey.toBase58() + "\n");
  });

program
  .command("create-wallets")
  .description("create N agent wallets and airdrop on devnet")
  .addOption(new Option("-n, --agents <n>", "number of agents").argParser(Number).default(3))
  .action(async (opts: { agents: number }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const list = await createWallets(opts.agents, PASSPHRASE, { metaDir: META_DIR, keystoreDir: KEYSTORE_DIR });
    logInfo("wallets created", { count: list.length });
    list.forEach(({ agentId, publicKey }) => logInfo("wallet", { agentId, publicKey }));
    const c = conn();
    await airdropAll(c, list.map((x) => x.agentId), META_DIR);
    logInfo("airdrop complete");
  });

program
  .command("airdrop")
  .description("retry airdrop for existing agents (no new wallets)")
  .action(async () => {
    const meta = await loadMetadata(META_DIR);
    if (meta.length === 0) {
      logError("no agents found", { hint: "run create-wallets first" });
      process.exit(1);
    }
    const c = conn();
    await airdropAll(c, meta.map((m) => m.agentId), META_DIR);
  });

program
  .command("close-wallets")
  .description("drain SOL from all agent wallets then wipe all local state (keystore, meta, memory, config)")
  .addOption(new Option("--drain-to <address>", "optional base58 address to sweep remaining SOL into before wiping"))
  .addOption(new Option("--force", "skip confirmation prompt"))
  .action(async (opts: { drainTo?: string; force?: boolean }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }

    const meta = await loadMetadata(META_DIR);
    if (meta.length === 0) {
      logInfo("no agents found — nothing to close");
      process.exit(0);
    }

    if (!opts.force) {
      const agentList = meta.map((m) => `  ${m.agentId}  ${m.publicKey}`).join("\n");
      process.stdout.write(
        `\nThis will permanently delete all local state for ${meta.length} agent(s):\n${agentList}\n\n` +
        `All .aegis/ data (keystore, meta, memory, config) will be removed.\n` +
        (opts.drainTo ? `SOL will be swept to: ${opts.drainTo}\n` : `SOL will be abandoned on devnet (worthless).\n`) +
        `\nPass --force to skip this prompt.\n\n` +
        `Type "yes" to continue: `
      );
      const answer = await new Promise<string>((resolve) => {
        let buf = "";
        process.stdin.setEncoding("utf-8");
        process.stdin.resume();
        process.stdin.on("data", (chunk: string) => {
          buf += chunk;
          if (buf.includes("\n")) {
            process.stdin.pause();
            resolve(buf.trim());
          }
        });
      });
      if (answer !== "yes") {
        logInfo("aborted");
        process.exit(0);
      }
    }

    const c = conn();
    let drainPubkey: PublicKey | null = null;
    if (opts.drainTo) {
      try {
        drainPubkey = new PublicKey(opts.drainTo);
      } catch {
        logError("invalid --drain-to address", { address: opts.drainTo });
        process.exit(1);
      }
    }

    // drain SOL from each agent into drainPubkey (if provided)
    if (drainPubkey) {
      for (const { agentId, publicKey } of meta) {
        if (!keypairExists(agentId, KEYSTORE_DIR)) {
          logWarn("keystore missing, skipping drain", { agentId });
          continue;
        }
        try {
          const pk = new PublicKey(publicKey);
          const balance = await c.getBalance(pk);
          // reserve ~5000 lamports for the transfer fee
          const FEE_RESERVE = 5000;
          const sendLamports = balance - FEE_RESERVE;
          if (sendLamports <= 0) {
            logInfo("balance too low to drain, skipping", { agentId, balance });
            continue;
          }
          const kp = await getKeypair(agentId, PASSPHRASE, KEYSTORE_DIR);
          const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey: pk, toPubkey: drainPubkey!, lamports: sendLamports })
          );
          const sig = await sendAndConfirmTransaction(c, tx, [kp], { commitment: "confirmed" });
          logInfo("drained", { agentId, lamports: sendLamports, sig });
        } catch (e) {
          logWarn("drain failed", { agentId, error: (e as Error).message });
        }
      }
    }

    // wipe .aegis/ subdirectories
    const dirs = [KEYSTORE_DIR, META_DIR, ".aegis/memory", ".aegis/config"];
    for (const dir of dirs) {
      try {
        await rm(dir, { recursive: true, force: true });
        logInfo("removed", { dir });
      } catch (e) {
        logWarn("could not remove dir", { dir, error: (e as Error).message });
      }
    }

    logInfo("all agent wallets closed", {
      agents: meta.length,
      hint: "run 'npm run create-wallets' to start fresh",
    });
  });

program
  .command("run")
  .description("run multi-agent simulation")
  .addOption(new Option("-n, --agents <n>", "number of agents").argParser(Number).default(3))
  .addOption(new Option("-r, --rounds <n>", "rounds").argParser(Number).default(1))
  .action(async (opts: { agents: number; rounds: number }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const meta = await loadMetadata(META_DIR);
    if (meta.length === 0) {
      logError("no agents found", { hint: "run create-wallets first" });
      process.exit(1);
    }
    const peers = peerPubkeysFromMeta(meta);
    const allowedRecipients = meta.map((m) => new PublicKey(m.publicKey));
    const allowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
    const c = conn();

    // load per-agent configs once
    const agentConfigs: Record<string, import("./agents/config.js").AgentConfig> = Object.fromEntries(
      await Promise.all(meta.map(async (m) => [m.agentId, await loadAgentConfig(m.agentId, CONFIG_DIR)]))
    );

    for (let r = 0; r < opts.rounds; r++) {
      logInfo("round start", { round: r + 1, total: opts.rounds });
      for (let i = 0; i < meta.length; i++) {
        const { agentId, publicKey } = meta[i];
        if (!keypairExists(agentId, KEYSTORE_DIR)) {
          logWarn("keystore missing, skipping", { agentId });
          continue;
        }

        // pick strategy: per-agent config overrides default rotation
        const cfg = agentConfigs[agentId] ?? {};
        const strategyName = cfg.strategy;
        const AgentFn = strategyName
          ? STRATEGY_MAP[strategyName]
          : FUNCTIONAL_AGENTS[i % FUNCTIONAL_AGENTS.length];

        // per-agent maxLamports override
        const perAgentMax = cfg.maxLamports;
        const effectiveAllowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
        const policy = defaultPolicy(allowedRecipients, effectiveAllowedPrograms);
        if (perAgentMax !== undefined) {
          policy.maxTransferLamports = perAgentMax;
        }

        const ctx = {
          agentId,
          peerPubkeys: peers,
          step: r * meta.length + i,
          testProgramId: AEGIS_TEST_PROGRAM_ID ?? undefined,
        };

        const intents = AgentFn(ctx as Parameters<typeof AgentFn>[0]);

        if (intents.length === 0) {
          logDebug("no intents this step", { agentId, step: ctx.step });
          continue;
        }

        for (const intent of intents) {
          logInfo("intent", {
            agentId,
            strategy: strategyName ?? `rotation[${i % FUNCTIONAL_AGENTS.length}]`,
            type: intent.type,
            step: ctx.step,
            round: r + 1,
          });
          try {
            const sig = await executeIntent(c, agentId, intent, PASSPHRASE, {
              keystoreDir: KEYSTORE_DIR,
              policy,
            });
            logInfo("tx confirmed", { agentId, sig, intent: intent.type });
          } catch (e) {
            logError("tx failed", { agentId, intent: intent.type, error: (e as Error).message });
          }
        }

        // show balance after this agent's turn
        try {
          const bal = await c.getBalance(new PublicKey(publicKey));
          logInfo("balance", { agentId, sol: (bal / 1e9).toFixed(4) });
        } catch {
          // non-fatal
        }
      }
    }
    logInfo("simulation complete", { rounds: opts.rounds, agents: meta.length });
  });

program
  .command("balance")
  .description("show SOL and SPL token balances per agent")
  .action(async () => {
    const meta = await loadMetadata(META_DIR);
    const c = conn();
    const mintB58 = await loadSplMint(META_DIR);

    for (const { agentId, publicKey } of meta) {
      const pk = new PublicKey(publicKey);
      const sol = await c.getBalance(pk);
      logInfo("balance", { agentId, publicKey, sol: (sol / 1e9).toFixed(4) + " SOL" });

      // SPL token balances
      try {
        const tokenAccounts = await c.getParsedTokenAccountsByOwner(pk, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
        for (const { account } of tokenAccounts.value) {
          const info = account.data.parsed?.info;
          if (!info) continue;
          const mint = info.mint as string;
          const amount = info.tokenAmount?.uiAmountString ?? "?";
          const label = mintB58 && mint === mintB58 ? " (aegis-test)" : "";
          logInfo("token balance", { agentId, mint: mint.slice(0, 8) + "..." + label, amount });
        }
      } catch {
        // no token accounts or RPC error – skip
      }
    }
  });

program
  .command("init-test-program")
  .description("initialize counter account for test program (run once after deploy)")
  .addOption(new Option("-a, --agent <id>", "agent to pay for init").default("agent_0"))
  .action(async (opts: { agent: string }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const meta = await loadMetadata(META_DIR);
    const m = meta.find((x) => x.agentId === opts.agent);
    if (!m) {
      logError("agent not found", { agent: opts.agent });
      process.exit(1);
    }
    if (!AEGIS_TEST_PROGRAM_ID) {
      logError("AEGIS_TEST_PROGRAM_ID not set in .env");
      logError("deploy: cd test-program && anchor build && anchor deploy --provider.cluster devnet");
      process.exit(1);
    }
    const c = conn();
    const programIdStr = AEGIS_TEST_PROGRAM_ID.toBase58();
    const programAccount = await c.getAccountInfo(AEGIS_TEST_PROGRAM_ID);
    if (!programAccount) {
      logError("no account on devnet", { programId: programIdStr, hint: "deploy the program first" });
      process.exit(1);
    }
    if (!programAccount.executable) {
      logError("account is not executable", { programId: programIdStr, hint: "fix AEGIS_TEST_PROGRAM_ID in .env" });
      process.exit(1);
    }
    const authority = new PublicKey(m.publicKey);
    const intent = buildInitCounterIntent(authority);
    const allowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
    const policy = defaultPolicy(meta.map((x) => new PublicKey(x.publicKey)), allowedPrograms);
    try {
      const sig = await executeIntent(c, opts.agent, intent, PASSPHRASE, { keystoreDir: KEYSTORE_DIR, policy });
      logInfo("init_counter tx", { sig });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already in use")) {
        logInfo("counter already initialized", { hint: "run: npm run run -- --agents 3 --rounds 2" });
        process.exit(0);
      }
      if (msg.includes("may not be used for executing instructions") || msg.includes("Simulation failed")) {
        logError("simulation failed", { programId: programIdStr, hint: "check AEGIS_TEST_PROGRAM_ID and deploy status" });
        process.exit(1);
      }
      throw e;
    }
  });

program
  .command("init-trades")
  .description("initialize DeFi trade state for test program (run once after deploy)")
  .addOption(new Option("-a, --agent <id>", "agent to pay for init").default("agent_0"))
  .action(async (opts: { agent: string }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const meta = await loadMetadata(META_DIR);
    const m = meta.find((x) => x.agentId === opts.agent);
    if (!m) {
      logError("agent not found", { agent: opts.agent });
      process.exit(1);
    }
    const authority = new PublicKey(m.publicKey);
    const intent = buildInitTradesIntent(authority);
    const allowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
    const policy = defaultPolicy(meta.map((x) => new PublicKey(x.publicKey)), allowedPrograms);
    const c = conn();
    try {
      const sig = await executeIntent(c, opts.agent, intent, PASSPHRASE, { keystoreDir: KEYSTORE_DIR, policy });
      logInfo("init_trades tx", { sig });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("may not be used for executing instructions") || msg.includes("Simulation failed")) {
        logError("test program not deployed or wrong program ID", { hint: "deploy and set AEGIS_TEST_PROGRAM_ID" });
        process.exit(1);
      }
      throw e;
    }
  });

program
  .command("spl-setup")
  .description("create test SPL mint and mint tokens to agent_0")
  .addOption(new Option("-a, --agent <id>", "agent to be mint authority and receive tokens").default("agent_0"))
  .addOption(new Option("-n, --amount <n>", "tokens to mint").argParser(Number).default(1000))
  .action(async (opts: { agent: string; amount: number }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const signer = await getKeypair(opts.agent, PASSPHRASE, KEYSTORE_DIR);
    const c = conn();
    const mint = await createMint(c, signer, signer.publicKey, null, 6, undefined, { commitment: "confirmed" });
    await saveSplMint(mint.toBase58(), META_DIR);
    const ataAddress = await createAssociatedTokenAccountIdempotent(c, signer, mint, signer.publicKey, { commitment: "confirmed" });
    await mintTo(c, signer, mint, ataAddress, signer, opts.amount, [], { commitment: "confirmed" });
    logInfo("SPL mint created", { mint: mint.toBase58(), mintedTo: opts.agent, amount: opts.amount });
  });

program
  .command("spl-transfer")
  .description("transfer SPL tokens between agents")
  .addOption(new Option("-f, --from <id>", "sender agent").default("agent_0"))
  .addOption(new Option("-t, --to <id>", "recipient agent").default("agent_1"))
  .addOption(new Option("-n, --amount <n>", "amount").argParser(Number).default(100))
  .action(async (opts: { from: string; to: string; amount: number }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const mintB58 = await loadSplMint(META_DIR);
    if (!mintB58) {
      logError("no SPL mint found", { hint: "run spl-setup first" });
      process.exit(1);
    }
    const meta = await loadMetadata(META_DIR);
    const toMeta = meta.find((x) => x.agentId === opts.to);
    if (!toMeta) {
      logError("recipient agent not found", { agent: opts.to });
      process.exit(1);
    }
    const allowedRecipients = meta.map((m) => new PublicKey(m.publicKey));
    const allowedPrograms = buildDefaultAllowedPrograms(AEGIS_TEST_PROGRAM_ID);
    const policy = defaultPolicy(allowedRecipients, allowedPrograms);
    const intent = {
      type: "transferSpl" as const,
      mint: new PublicKey(mintB58),
      to: new PublicKey(toMeta.publicKey),
      amount: opts.amount,
    };
    const c = conn();
    const sig = await executeIntent(c, opts.from, intent, PASSPHRASE, { keystoreDir: KEYSTORE_DIR, policy });
    logInfo("spl-transfer tx", { sig, from: opts.from, to: opts.to, amount: opts.amount });
  });

program
  .command("config-agent")
  .description("write per-agent JSON config to .aegis/config/<agentId>.json")
  .addOption(new Option("-a, --agent <id>", "agent id").default("agent_0"))
  .addOption(new Option("-s, --strategy <s>", "strategy: trader|liquidity|conservative|defiTrader"))
  .addOption(new Option("-m, --max-lamports <n>", "max lamports per transfer").argParser(Number))
  .action(async (opts: { agent: string; strategy?: string; maxLamports?: number }) => {
    const { saveAgentConfig } = await import("./agents/config.js");
    const config: import("./agents/config.js").AgentConfig = {};
    if (opts.strategy) config.strategy = opts.strategy as AgentStrategy;
    if (opts.maxLamports !== undefined) config.maxLamports = opts.maxLamports;
    await saveAgentConfig(opts.agent, config, CONFIG_DIR);
    logInfo("agent config saved", { agent: opts.agent, config });
  });

program
  .command("llm-run")
  .description("start LLM agent scheduler (Sentinel, Trader, Experimental) – runs until Ctrl+C")
  .addOption(new Option("-i, --interval <ms>", "tick interval in ms").argParser(Number).default(30000))
  .addOption(new Option("--once", "run one tick then exit (useful for testing)"))
  .action(async (opts: { interval: number; once?: boolean }) => {
    if (!PASSPHRASE) {
      logError("KEYSTORE_PASSPHRASE not set in .env");
      process.exit(1);
    }
    const { startScheduler } = await import("./scheduler.js");
    await startScheduler({ intervalMs: opts.interval, once: opts.once });
  });

program
  .command("serve")
  .description("start monitoring API server on port 3000 (for frontend dashboard)")
  .action(async () => {
    const { startApiServer } = await import("./api.js");
    startApiServer();
  });

program.parse();
