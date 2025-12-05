import type { ModelConfig } from "./types";

export const availableModels: ModelConfig[] = [
  {
    id: "xai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    provider: "xAI",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "OpenAI",
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
  },
  {
    id: "openai/gpt-5-codex",
    name: "GPT-5 Codex",
    provider: "OpenAI",
  },
  { id: "user", name: "You (User)", provider: "Human" },
];

export function getGatewayCompletionsUrl(): string {
  const baseUrl = process.env.AI_GATEWAY_URL || "";
  // Ensure we have the full chat/completions endpoint
  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }
  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}/chat/completions`;
  }
  if (baseUrl.endsWith("/")) {
    return `${baseUrl}chat/completions`;
  }
  return `${baseUrl}/chat/completions`;
}

const SYSTEM_PROMPT = `You are an expert Vim golfer. Your task is to transform the START text into the TARGET text using the minimum number of Vim keystrokes.

CRITICAL RULES:
1. Output ONLY Vim keystrokes. No commentary. No markdown. No quotes. No explanations.
2. Use standard Vim notation: <Esc>, <CR>, <BS> for special keys
3. For substitute commands use: :%s/pattern/replacement/g<CR>
4. Optimize for minimum keystrokes
5. The cursor starts at position 0,0 (first character of first line)
6. You start in Normal mode

Example valid outputs:
- cwfoo<Esc>
- :%s/old/new/g<CR>
- ggdG
- A;<Esc>j.j.`;

export async function callAIGateway(
  modelId: string,
  startText: string,
  targetText: string
): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!process.env.AI_GATEWAY_URL || !apiKey) {
    throw new Error("AI Gateway not configured");
  }

  const completionsUrl = getGatewayCompletionsUrl();

  const prompt = `START TEXT:
\`\`\`
${startText}
\`\`\`

TARGET TEXT:
\`\`\`
${targetText}
\`\`\`

Output ONLY the Vim keystrokes to transform START into TARGET:`;

  const response = await fetch(completionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return cleanKeystrokes(content);
}

export function cleanKeystrokes(raw: string): string {
  let cleaned = raw.trim();

  // 1. Extract content from markdown code blocks
  // Matches:
  // ```[language]\n[content]\n```
  // ```[language][content]``` (no newlines)
  // ```[content]```
  const codeBlockRegex = /```(?:vim|text)?\s*([\s\S]*?)\s*```/;
  const match = cleaned.match(codeBlockRegex);

  if (match) {
    cleaned = match[1];
  } else {
    // Fallback: Remove any markdown ticks if they wrap the whole string
    if (cleaned.startsWith("`") && cleaned.endsWith("`")) {
      cleaned = cleaned.slice(1, -1);
    }
  }

  // 2. Remove any "keystrokes:" prefix
  cleaned = cleaned.replace(/^(keystrokes?:?\s*)/i, "");

  // 3. Remove quotes if wrapping the whole string
  cleaned = cleaned.replace(/^["']|["']$/g, "");

  // 4. Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}
