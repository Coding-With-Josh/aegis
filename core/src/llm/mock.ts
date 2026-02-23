import type { LLMProvider } from "./provider.js";

const MOCK_RESPONSES = [
  {
    action: "hold",
    reasoning: "no clear opportunity this cycle, sitting tight and preserving capital",
    to: null,
    lamports: null,
    amount: null,
    mint: null,
    confidence: 0.6,
  },
  {
    action: "transfer",
    reasoning: "small transfer to a peer wallet, just checking liquidity distribution looks healthy",
    to: null,
    lamports: 1000000,
    amount: null,
    mint: null,
    confidence: 0.72,
  },
  {
    action: "hold",
    reasoning: "watching on-chain conditions before committing anything, better safe than sorry",
    to: null,
    lamports: null,
    amount: null,
    mint: null,
    confidence: 0.55,
  },
];

let mockIdx = 0;

export class MockProvider implements LLMProvider {
  readonly name = "mock:local";

  async complete(_system: string, userPrompt: string): Promise<string> {
    const resp = { ...MOCK_RESPONSES[mockIdx % MOCK_RESPONSES.length] };
    mockIdx++;

    // pull the first peer address out of the prompt so the transfer has a target
    if (resp.action === "transfer" && resp.to === null) {
      const match = userPrompt.match(/peer_\d+: ([A-Za-z0-9]{32,44})/);
      if (match) {
        (resp as { to: string | null }).to = match[1];
      } else {
        (resp as { action: string }).action = "hold";
      }
    }

    return JSON.stringify(resp);
  }
}
