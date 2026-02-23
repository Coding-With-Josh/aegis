import { z } from "zod";
import type { LLMProvider } from "./provider.js";
import { logWarn } from "../logger.js";

export const IntentRequestSchema = z.object({
  action: z.enum(["transfer", "transferSpl", "callProgram", "hold"]),
  reasoning: z.string().min(20, "reasoning must be at least 20 characters"),
  to: z.string().nullish(),
  lamports: z.union([z.number().positive(), z.null()]).optional(),
  amount: z.union([z.number().positive(), z.null()]).optional(),
  mint: z.string().nullish(),
  confidence: z.number().min(0).max(1),
});

export type IntentRequest = z.infer<typeof IntentRequestSchema>;

const HOLD_FALLBACK: IntentRequest = {
  action: "hold",
  reasoning: "provider kept returning garbage, falling back to hold after max retries",
  to: null,
  lamports: null,
  amount: null,
  mint: null,
  confidence: 0,
};

export async function parseWithRetry(
  provider: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  maxAttempts = 3
): Promise<IntentRequest> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const prompt = attempt === 1
        ? userPrompt
        : `${userPrompt}\n\nYour previous response was invalid: ${lastError}\nReturn valid JSON matching the required schema exactly.`;

      const raw = await provider.complete(systemPrompt, prompt);
      const parsed = JSON.parse(raw);
      const result = IntentRequestSchema.safeParse(parsed);

      if (result.success) return result.data;

      lastError = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      logWarn("llm response failed schema validation", { attempt, error: lastError, raw: raw.slice(0, 200) });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logWarn("llm response parse error", { attempt, error: lastError });
    }
  }

  return HOLD_FALLBACK;
}
