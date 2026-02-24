import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { agentRoutes } from "./routes/agents.js";
import { executeRoutes } from "./routes/execute.js";
import { getDb } from "./db.js";
import { getRpcEndpointHost } from "./rpc.js";
import { expireStalePending } from "./hitl/approval.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

await app.register(cors, { origin: "*" });

app.get("/health", async () => ({
  status: "ok",
  ts: new Date().toISOString(),
  rpcEndpoint: getRpcEndpointHost(),
}));

await app.register(agentRoutes);
await app.register(executeRoutes);

getDb();

// expire stale pending transactions on startup and every 5 minutes
expireStalePending();
setInterval(expireStalePending, 5 * 60 * 1000);

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`@aegis-ai/node running on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
