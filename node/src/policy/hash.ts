import { createHash } from "node:crypto";
import type { AgentPolicy } from "./types.js";

export function hashPolicy(policy: AgentPolicy): string {
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(policy).sort(([a], [b]) => a.localeCompare(b)))
  );
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function hashIntent(intent: { type: string; params: Record<string, unknown> }): string {
  const sortedParams = Object.fromEntries(
    Object.entries(intent.params).sort(([a], [b]) => a.localeCompare(b))
  );
  const canonical = JSON.stringify({ type: intent.type, params: sortedParams });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
