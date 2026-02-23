import { OpenAIProvider } from "../../llm/openai.js";
import { GroqProvider } from "../../llm/groq.js";
import type { LLMProvider } from "../../llm/provider.js";
import { BaseLLMAgent, type LLMAgentOpts } from "./base-llm-agent.js";

const PERSONALITY = `
You are a capital preservation guardian. Your only job is protecting the wallet's funds.
You are extremely conservative. You only act when you are highly confident.
You refuse anything that risks more than 10% of the wallet in one shot.
You prefer to hold when uncertain. You only transfer to known peer wallets.
You never touch programs or smart contracts.
`.trim();

function buildProvider(): LLMProvider {
  if (process.env.GROQ_API_KEY) return new GroqProvider({ model: "llama-3.3-70b-versatile", temperature: 0.1 });
  return new OpenAIProvider({ model: "gpt-4o-mini", temperature: 0.1 });
}

export class SentinelAgent extends BaseLLMAgent {
  readonly name = "Aegis Sentinel";

  constructor(opts: Omit<LLMAgentOpts, "provider" | "riskProfile" | "personality">) {
    super({
      ...opts,
      provider: buildProvider(),
      personality: PERSONALITY,
      riskProfile: {
        maxPct: 0.10,
        allowedActions: ["transfer", "hold"],
        minReasoningLength: 30,
      },
    });
  }
}
