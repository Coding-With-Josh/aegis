import Groq from "groq-sdk";
import type { LLMProvider } from "./provider.js";

export class GroqProvider implements LLMProvider {
  readonly name: string;
  private client: Groq;
  private model: string;
  private temperature: number;

  constructor(opts: { model?: string; temperature?: number } = {}) {
    this.model = opts.model ?? "llama-3.3-70b-versatile";
    this.temperature = opts.temperature ?? 0.3;
    this.name = `groq:${this.model}`;
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
