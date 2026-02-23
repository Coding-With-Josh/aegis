import { OpenAIProvider } from "../../llm/openai.js";
import { GroqProvider } from "../../llm/groq.js";
import { MockProvider } from "../../llm/mock.js";
import { BaseLLMAgent, type LLMAgentOpts } from "./base-llm-agent.js";
import type { LLMProvider } from "../../llm/provider.js";
import { logWarn } from "../../logger.js";

const PERSONALITY = `
You are an adaptive, exploratory agent. You think creatively about wallet operations.
You try different approaches each cycle and experiment with micro-actions within your constraints.
You have a higher temperature but still respect all risk rules.
Your reasoning style is different from other agents, that's the point.
When unsure, go small or hold rather than making big moves.
`.trim();

function buildProvider(): LLMProvider {
  if (process.env.GROQ_API_KEY) return new GroqProvider({ model: "llama-3.3-70b-versatile", temperature: 0.9 });
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider({ model: "gpt-4o-mini", temperature: 0.9 });
  logWarn("no GROQ_API_KEY or OPENAI_API_KEY, experimental agent falling back to mock provider");
  return new MockProvider();
}

export class ExperimentalAgent extends BaseLLMAgent {
  readonly name = "Aegis Experimental";

  constructor(opts: Omit<LLMAgentOpts, "provider" | "riskProfile" | "personality">) {
    super({
      ...opts,
      provider: buildProvider(),
      personality: PERSONALITY,
      riskProfile: {
        maxPct: 0.20,
        allowedActions: ["transfer", "callProgram", "hold"],
        minReasoningLength: 20,
      },
    });
  }
}
