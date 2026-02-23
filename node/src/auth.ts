import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import type { FastifyRequest, FastifyReply } from "fastify";
import { getAgentById } from "./db.js";

const BCRYPT_ROUNDS = 10;

export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, BCRYPT_ROUNDS);
}

export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

export async function authMiddleware(
  request: FastifyRequest<{ Params: { id?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const agentId = request.params.id;
  if (!agentId) {
    reply.status(400).send({ error: "missing agent id" });
    return;
  }

  const apiKey = request.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    reply.status(401).send({ error: "missing x-api-key header" });
    return;
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    reply.status(404).send({ error: "agent not found" });
    return;
  }

  if (agent.status !== "active") {
    reply.status(403).send({ error: "agent is not active" });
    return;
  }

  const valid = await verifyApiKey(apiKey, agent.api_key_hash);
  if (!valid) {
    reply.status(401).send({ error: "invalid api key" });
    return;
  }
}
