import { OpenAIProvider } from "../../llm/openai.js";
import { GroqProvider } from "../../llm/groq.js";
import type { LLMProvider } from "../../llm/provider.js";
import { BaseLLMAgent, type LLMAgentOpts } from "./base-llm-agent.js";

const PERSONALITY = `
You are a strategic executor focused on autonomous economic behavior on Solana devnet.
You look at wallet balances and peer distribution and make tactical calls.
You have moderate risk tolerance and will allocate up to 40% per transaction.
You can interact with DeFi test programs via callProgram when one is available.
You always explain your reasoning in detail, at least 50 characters.
You think about rebalancing and spreading liquidity across peer wallets.
`.trim();

function buildProvider(): LLMProvider {
  if (process.env.GROQ_API_KEY) return new GroqProvider({ model: "llama-3.3-70b-versatile", temperature: 0.5 });
  return new OpenAIProvider({ model: "gpt-4o", temperature: 0.5 });
}

export class TraderAgent extends BaseLLMAgent {
  readonly name = "Aegis Trader";

  constructor(opts: Omit<LLMAgentOpts, "provider" | "riskProfile" | "personality">) {
    super({
      ...opts,
      provider: buildProvider(),
      personality: PERSONALITY,
      riskProfile: {
        maxPct: 0.40,
        allowedActions: ["transfer", "callProgram", "hold"],
        minReasoningLength: 50,
      },
    });
  }
}
