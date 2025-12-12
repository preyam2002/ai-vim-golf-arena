import type { ModelConfig } from "./types";
import { generateText, gateway, createGateway } from "ai";

// Models available for Vim Golf challenges - all through Vercel AI Gateway
// Model IDs are WITHOUT provider prefix per Vercel AI Gateway convention
export const availableModels: ModelConfig[] = [
  // OpenAI
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
  },
  {
    id: "o1",
    name: "o1 (Reasoning)",
    provider: "OpenAI",
    isThinking: true,
  },
  {
    id: "o3-mini",
    name: "o3 Mini (Reasoning)",
    provider: "OpenAI",
    isThinking: true,
  },

  // Anthropic
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
  },

  // Google
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
  },

  // xAI
  {
    id: "grok-2",
    name: "Grok 2",
    provider: "xAI",
  },

  // DeepSeek
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1 (Reasoning)",
    provider: "DeepSeek",
    isThinking: true,
  },

  // Mistral
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "Mistral",
  },
];

const SYSTEM_PROMPT = `You are an expert Vim golfer. Transform START into TARGET with the ABSOLUTE MINIMUM Vim keystrokes.

## REASONING (Think Step-by-Step)
1. Analyze: What changes are needed between START and TARGET?
2. Options: List 2-3 approaches (substitution, macros, ranges, etc.)
3. Count: Estimate keystrokes for each approach
4. Choose: Pick the approach with FEWEST keystrokes
5. Verify: Confirm your solution produces exact TARGET

## OUTPUT RULES (Strict)
- Output ONLY raw Vim keystrokes - NO markdown, NO explanation, NO code blocks
- Use notation: <Esc>, <CR>, <BS> for special keys
- Cursor starts at 0,0 in Normal mode
- First character must be a valid Vim keystroke

## EFFICIENCY PATTERNS
- :%s/old/new/g<CR> beats repeated cwfoo<Esc>
- :3,6d<CR> beats dddddd
- . (dot repeat) for repetitive edits
- Macros (q<reg>..q @<reg>) for complex repeats
- :g/pattern/d<CR> for multi-line deletes

Example valid outputs (plain text, nothing else):
- cwfoo<Esc>
- :%s/old/new/g<CR>
- ggdG`;

/**
 * Create gateway instance with API key
 */
function getGatewayInstance() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }
  return createGateway({ apiKey });
}

/**
 * Get provider-specific options to enable thinking/reasoning mode
 * These work through the gateway - use the actual provider name as the key
 */
function getProviderOptions(modelId: string): Record<string, unknown> {
  // OpenAI reasoning models (o1, o3-mini)
  if (modelId === "o1" || modelId === "o3-mini") {
    return {
      openai: {
        reasoningEffort: "medium", // 'low', 'medium', 'high'
      },
    };
  }

  // DeepSeek R1 uses deepseek-r1 model directly, usually no extra options needed

  return {};
}

/**
 * Build the user prompt for the Vim golf challenge
 */
function buildPrompt(startText: string, targetText: string): string {
  return [
    "START TEXT:",
    "```",
    startText,
    "```",
    "",
    "TARGET TEXT:",
    "```",
    targetText,
    "```",
    "",
    "Return ONLY the Vim keystrokes to transform START into TARGET.",
    "Do not include markdown, quotes, explanations, or extra lines.",
  ].join("\n");
}

/**
 * Determine max tokens based on model capabilities
 */
function getMaxTokens(modelId: string): number {
  if (modelId === "claude-3-opus") return 4096; // Hard limit for Opus
  if (modelId.includes("claude-3.5")) return 8192;
  return 4096; // Safe default for most models
}

/**
 * Call the AI provider using Vercel AI Gateway (single API key)
 */
export async function callAIGateway(
  modelId: string,
  startText: string,
  targetText: string,
  _apiKeyOverride?: string // kept for backward compatibility
): Promise<string> {
  const gatewayInstance = getGatewayInstance();
  const providerOptions = getProviderOptions(modelId);

  // Reasoning models (o1, o3-mini, deepseek-r1) do not support system prompts or temperature
  const isReasoningModel =
    modelId === "o1" || modelId === "o3-mini" || modelId === "deepseek-r1";

  // For reasoning models, include system instructions in the user prompt
  const fullPrompt = isReasoningModel
    ? `${SYSTEM_PROMPT}\n\n${buildPrompt(startText, targetText)}`
    : buildPrompt(startText, targetText);

  const { text } = await generateText({
    model: gatewayInstance(modelId),
    // Reasoning models don't support system prompts - omit for them
    system: isReasoningModel ? undefined : SYSTEM_PROMPT,
    prompt: fullPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions: providerOptions as any,
    maxOutputTokens: getMaxTokens(modelId),
    temperature: isReasoningModel ? undefined : 0.1,
  });

  const cleaned = cleanKeystrokes(text);

  if (!cleaned.trim()) {
    throw new Error(
      `AI Gateway returned empty content (model=${modelId}, raw=${text.slice(
        0,
        160
      )})`
    );
  }

  return cleaned;
}

/**
 * Clean keystrokes from model output
 */
export function cleanKeystrokes(raw: string): string {
  let cleaned = raw.trim();

  // 1. Extract content from markdown code blocks
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
  cleaned = cleaned.replace(/^['"]|['"]$/g, "");

  // 4. Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract content from various response formats (kept for compatibility)
 */
export function extractGatewayContent(rawContent: unknown): string {
  if (rawContent === null || rawContent === undefined) return "";
  if (typeof rawContent === "string") return rawContent;

  if (Array.isArray(rawContent)) {
    return rawContent.map(extractGatewayContent).filter(Boolean).join("");
  }

  if (typeof rawContent === "object") {
    const obj = rawContent as Record<string, unknown>;
    const fields = ["text", "content", "value", "output_text", "message"];
    const pieces: string[] = [];

    for (const field of fields) {
      if (field in obj) {
        pieces.push(extractGatewayContent(obj[field]));
      }
    }

    if (Array.isArray(obj.parts)) {
      pieces.push(...obj.parts.map(extractGatewayContent));
    }

    return pieces.filter(Boolean).join("");
  }

  return "";
}
