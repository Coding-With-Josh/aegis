import OpenAI from "openai";
import type { LLMProvider } from "./provider.js";

export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;
  private temperature: number;

  constructor(opts: { model?: string; temperature?: number } = {}) {
    this.model = opts.model ?? "gpt-4o-mini";
    this.temperature = opts.temperature ?? 0.3;
    this.name = `openai:${this.model}`;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content ?? "{}";
  }
}
