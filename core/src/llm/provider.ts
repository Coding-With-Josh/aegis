export interface LLMProvider {
  readonly name: string;
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
