import "dotenv/config";
import express from "express";
import { join } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadMetadata } from "./wallet-factory/metadata.js";
import { readHistory, readAllHistory } from "./memory/store.js";
import { buildLLMRegistry } from "./agents/llm/registry.js";
import { logInfo } from "./logger.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const META_DIR = ".aegis/meta";
const MEMORY_DIR = ".aegis/memory";
const PORT = parseInt(process.env.API_PORT ?? "5000", 10);

const app = express();

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.use(express.static(join(process.cwd(), "frontend")));

app.get("/api/state", async (_req, res) => {
  try {
    const meta = await loadMetadata(META_DIR);
    const c = new Connection(RPC);
    const registry = buildLLMRegistry(meta.map((m) => m.agentId), MEMORY_DIR);

    const agents = await Promise.all(
      meta.map(async (m) => {
        const entry = registry.find((r) => r.agentId === m.agentId);
        let balanceSol = 0;
        try {
          balanceSol = (await c.getBalance(new PublicKey(m.publicKey))) / 1e9;
        } catch { /* rpc can be slow, just leave balance at 0 */ }

        const history = await readHistory(m.agentId, 5, MEMORY_DIR);
        const last = history[history.length - 1] ?? null;

        return {
          agentId: m.agentId,
          publicKey: m.publicKey,
          agentName: entry?.agent.name ?? m.agentId,
          provider: entry?.agent.provider.name ?? "unknown",
          riskProfile: entry?.agent.riskProfile ?? null,
          balanceSol,
          lastAction: last?.action ?? null,
          lastReasoning: last?.reasoning ?? null,
          lastTs: last?.ts ?? null,
          lastSig: last?.sig ?? null,
        };
      })
    );

    const recentHistory = await readAllHistory(meta.map((m) => m.agentId), 100, MEMORY_DIR);

    res.json({ ts: new Date().toISOString(), agents, recentHistory });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/history/:agentId", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) ?? "100", 10);
    const history = await readHistory(req.params.agentId, limit, MEMORY_DIR);
    res.json({ agentId: req.params.agentId, history });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/agents", async (_req, res) => {
  try {
    const meta = await loadMetadata(META_DIR);
    res.json({ agents: meta });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export function startApiServer(): void {
  app.listen(PORT, () => {
    logInfo("api server started", { port: PORT, url: `http://localhost:${PORT}` });
  });
}

if (process.argv[1]?.endsWith("api.js")) {
  startApiServer();
}
