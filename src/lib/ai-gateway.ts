import type { ModelConfig } from "./types";

// Models routed through Vercel AI Gateway (OpenAI-compatible surface)
export const availableModels: ModelConfig[] = [
  // One top model per provider
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "OpenAI via AI Gateway",
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google via AI Gateway",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic via AI Gateway",
  },
  {
    id: "xai/grok-4-fast-reasoning",
    name: "Grok 4 Fast Reasoning",
    provider: "xAI via AI Gateway",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek via AI Gateway",
  },
  {
    id: "mistral/mistral-large-latest",
    name: "Mistral Large",
    provider: "Mistral via AI Gateway",
  },
];

const SYSTEM_PROMPT = `You are an expert Vim golfer. Transform START into TARGET with the FEWEST possible Vim keystrokes.

HARD RULES (no exceptions):
- Output ONLY raw Vim keystrokes. Absolutely NO prose, NO markdown fences, NO quoting, NO JSON, NO echo of START/TARGET.
- First emitted character must be a keystroke (e.g., g, :, /, A, 0, <Esc>, <CR>, <BS>). Do not emit newlines or spaces first.
- Use standard Vim notation: <Esc>, <CR>, <BS> for special keys.
- For substitutes use the exact form :%s/pattern/replacement/g<CR>.
- Stay minimal: every extra character is wrong.
- Cursor starts at 0,0 in Normal mode.

Example valid outputs (single line, nothing else):
- cwfoo<Esc>
- :%s/old/new/g<CR>
- ggdG
- A;<Esc>j.j.`;

export async function callAIGateway(
  modelId: string,
  startText: string,
  targetText: string,
  apiKeyOverride?: string
): Promise<string> {
  const apiKey = getGatewayApiKey(apiKeyOverride);
  const normalizedModel = normalizeModelId(modelId);
  const baseURL = getOpenAIBaseUrl().replace(/\/+$/, "");
  const endpoint = `${baseURL}/chat/completions`;

  const isGoogle = normalizedModel.startsWith("google/");
  const maxTokens = 10000; // temporarily allow more room for providers that truncate early
  const stop = isGoogle ? ["\n"] : undefined;

  const prompt = [
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: normalizedModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false,
      ...(stop ? { stop } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await safeReadText(response);
    throw new Error(
      `AI Gateway request failed: ${response.status} ${response.statusText} ${errorText}`.trim()
    );
  }

  const data = await response.json().catch((err) => {
    throw new Error(`AI Gateway returned non-JSON response: ${String(err)}`);
  });

  if (data?.error) {
    const message =
      typeof data.error?.message === "string"
        ? data.error.message
        : JSON.stringify(data.error);
    throw new Error(`AI Gateway error response: ${message}`);
  }

  const choice = data?.choices?.[0];
  let rawContent =
    choice?.message?.content ??
    choice?.message?.output_text ??
    choice?.output_text ??
    data?.output_text ??
    "";

  // DeepSeek R1 and some providers may return reasoning text while content is empty
  if (
    !rawContent ||
    (typeof rawContent === "string" && rawContent.trim().length === 0)
  ) {
    const reasoningFallback =
      choice?.message?.reasoning ??
      choice?.message?.reasoning_details ??
      choice?.reasoning ??
      data?.reasoning ??
      data?.reasoning_details;
    if (reasoningFallback) {
      rawContent = reasoningFallback;
    }
  }
  const text = extractGatewayContent(rawContent);

  const cleaned = cleanKeystrokes(text);
  if (!cleaned.trim()) {
    const debugRaw =
      typeof rawContent === "string"
        ? rawContent
        : JSON.stringify(rawContent ?? "");
    let gatewaySnapshot = "";
    try {
      gatewaySnapshot = JSON.stringify(data).slice(0, 800);
    } catch {
      gatewaySnapshot = String(data).slice(0, 800);
    }
    throw new Error(
      `AI Gateway returned empty content (model=${normalizedModel}, raw=${debugRaw.slice(
        0,
        160
      )}) ${summarizeGatewayResponse(data)} gatewayResponse=${gatewaySnapshot}`
    );
  }

  return cleaned;
}

function getGatewayApiKey(apiKeyOverride?: string): string {
  const apiKey = apiKeyOverride || process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }
  return apiKey;
}

function normalizeModelId(modelId: string): string {
  // Preserve provider prefix; allow bare model names for convenience
  if (modelId.includes("/")) return modelId;
  const aliasMap: Record<string, string> = {
    "gpt-5-mini": "openai/gpt-5-mini",
    "gpt-4o": "openai/gpt-5-mini", // fallback to best available
    "gpt-4.1": "openai/gpt-5-mini", // fallback to best available
    "gemini-3-pro": "google/gemini-2.0-flash", // fallback to working google model
    "gemini-3-pro-preview": "google/gemini-2.0-flash", // fallback to working google model
    "gemini-2.5-flash": "google/gemini-2.0-flash", // fallback to working google model
    "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
    "claude-3.7-sonnet": "anthropic/claude-sonnet-4.5", // fallback to latest
    "grok-4-fast-reasoning": "xai/grok-4-fast-reasoning",
    "grok-4": "xai/grok-4-fast-reasoning",
    "deepseek-r1": "deepseek/deepseek-r1",
    "mistral-large": "mistral/mistral-large-latest",
    "mistral-large-latest": "mistral/mistral-large-latest",
  };
  return aliasMap[modelId] || modelId;
}

function getGatewayBase(): string {
  const base = process.env.AI_GATEWAY_URL;
  if (!base) {
    throw new Error("AI_GATEWAY_URL is not configured");
  }
  return base;
}

export function extractGatewayContent(rawContent: unknown): string {
  // Handles OpenAI-style string content and Gemini/Google array-of-parts responses
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
  cleaned = cleaned.replace(/^['"]|['"]$/g, "");

  // 4. Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

function getOpenAIBaseUrl(): string {
  const base = getGatewayBase().replace(/\/+$/, "");

  // If caller provided full chat completions path, strip it back to /v1
  if (/\/v1\/chat\/completions$/.test(base)) {
    return base.replace(/\/chat\/completions$/, "");
  }

  if (/\/chat\/completions$/.test(base)) {
    return `${base.replace(/\/chat\/completions$/, "")}/v1`;
  }

  if (/\/v1$/.test(base)) {
    return base;
  }

  return `${base}/v1`;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return String(error);
  }
}

function summarizeGatewayResponse(data: any): string {
  try {
    const choice = data?.choices?.[0];
    const finishReason =
      choice?.finish_reason ?? choice?.finishReason ?? choice?.finish_reason;
    const refusal =
      choice?.message?.refusal ??
      choice?.refusal ??
      (choice?.message as any)?.safety_results;
    const promptFeedback =
      data?.prompt_feedback ?? data?.safety_results ?? data?.safety_ratings;
    const contentType = Array.isArray(choice?.message?.content)
      ? "array"
      : typeof choice?.message?.content;
    const partialContent =
      typeof choice?.message?.content === "string"
        ? choice.message.content.slice(0, 120)
        : "";
    const errorMessage =
      typeof data?.error?.message === "string" ? data.error.message : undefined;

    const summary = {
      id: data?.id ?? data?.trace_id,
      finishReason,
      refusal,
      promptFeedback,
      contentType,
      hasOutputText: Boolean(data?.output_text),
      partialContent,
      errorMessage,
    };

    return `responseSummary=${JSON.stringify(summary)}`;
  } catch (err) {
    return `responseSummaryError=${String(err)}`;
  }
}
