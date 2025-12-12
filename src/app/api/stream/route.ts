import type { NextRequest } from "next/server";
import type { RunResult } from "@/lib/types";
import {
  availableModels,
  callAIGateway,
  cleanKeystrokes,
} from "@/lib/ai-gateway";
import { getOfflineSolution, hasOfflineSolution } from "@/lib/offline-library";
import { isDefaultChallengeId } from "@/lib/challenge-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 300;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(headers: HeadersInit = {}) {
  return { ...corsHeaders, ...headers };
}

export async function OPTIONS() {
  return new Response("ok", {
    status: 200,
    headers: corsHeaders,
  });
}

// System prompt and prompting logic is now in ai-gateway.ts
// This route uses callAIGateway which handles all prompting internally

export async function POST(request: NextRequest) {
  try {
    return await handleStreamPost(request);
  } catch (error: any) {
    console.error("[Stream API] Fatal top-level error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
}

async function handleStreamPost(request: NextRequest) {
  const body = await request.json();
  const { startText, targetText, modelId, challengeId } = body;
  // AI SDK uses provider-specific env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
  // No unified API key needed anymore

  if (!startText || !targetText || !modelId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }

  const model = availableModels.find((m) => m.id === modelId) || {
    id: modelId,
    name: modelId,
    provider: "custom",
  };

  const cachedSolution =
    challengeId && getOfflineSolution(challengeId, modelId);

  if (cachedSolution) {
    console.log(
      `[stream] offline cache hit challenge=${challengeId} model=${modelId}`
    );
    return streamFromCachedSolution(cachedSolution);
  }

  const isDefault = challengeId ? isDefaultChallengeId(challengeId) : false;

  const { store } = challengeId ? await import("@/lib/store") : { store: null };

  // Check DB/Redis cache for default challenges
  if (challengeId && isDefault && store) {
    const stored = await store.getResult(challengeId, modelId);
    if (stored) {
      console.log(
        `[stream] default db cache hit challenge=${challengeId} model=${modelId}`
      );
      return streamFromCachedSolution(stored);
    }
    console.warn(
      `[stream] default cache miss challenge=${challengeId} model=${modelId} (will generate with apiKey)`
    );
  }

  // Check if this is the daily challenge
  const { getDailyChallenge } = await import("@/lib/challenge-source");

  const today = new Date().toISOString().split("T")[0];
  const dailyChallenge = getDailyChallenge(today);
  const dailyId = dailyChallenge.id;

  console.log(
    `[Stream API] Processing request for challengeId: ${challengeId}`
  );
  console.log(`[Stream API] Today: ${today}, Daily ID: ${dailyId}`);

  const isDaily = challengeId && challengeId === dailyId;
  console.log(`[Stream API] isDaily: ${isDaily}`);

  if (isDaily) {
    const cachedResult = store
      ? await store.getResult(challengeId, modelId)
      : undefined;
    if (cachedResult) {
      console.log(
        `[stream] daily cache hit challenge=${challengeId} model=${modelId}`
      );
      return streamFromCachedSolution(cachedResult);
    }
    console.warn(
      `[stream] daily cache miss challenge=${challengeId} model=${modelId} (will generate with apiKey)`
    );
  }

  // AI Gateway uses a single API key for all providers
  if (!process.env.AI_GATEWAY_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "Missing API key: AI_GATEWAY_API_KEY environment variable is not set",
        debug: { challengeId, dailyId, isDaily, isDefault },
      }),
      {
        status: 401,
        headers: withCors({ "Content-Type": "application/json" }),
      }
    );
  }

  try {
    const startTime = Date.now();
    console.log(
      `[stream] invoking AI SDK challenge=${
        challengeId ?? "custom"
      } model=${modelId}`
    );
    // callAIGateway now uses AI SDK internally with provider env vars
    const keystrokes = await callAIGateway(modelId, startText, targetText);
    const cleanedKeystrokes = cleanKeystrokes(keystrokes);
    if (!cleanedKeystrokes.trim()) {
      return new Response(
        JSON.stringify({
          error: "Model returned empty keystrokes",
          debug: { modelId, challengeId, isDaily },
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const tokens = cleanedKeystrokes.split("");
    const encoder = new TextEncoder();
    const tokenTimeline: { token: string; timestampMs: number }[] = [];
    const tokenDelayMs = Math.max(
      1,
      Math.min(10, Math.floor(500 / Math.max(tokens.length, 1)))
    );

    const stream = new ReadableStream({
      async start(controller) {
        let persisted = false;
        const persistResult = async (timeMs: number) => {
          if (persisted || !challengeId) return;
          persisted = true;
          const { store } = await import("@/lib/store");
          const existing = await store.getResult(challengeId, modelId);
          if (existing) return;
          await store.saveResult(challengeId, {
            modelId,
            modelName: model.name ?? modelId,
            keystrokes: cleanedKeystrokes,
            keystrokeCount: cleanedKeystrokes.length,
            timeMs,
            success: true,
            finalText: "",
            steps: [],
            diffFromBest: 0,
            tokenTimeline: tokenTimeline.slice(),
          });
        };

        for (const token of tokens) {
          const timestampMs = Date.now() - startTime;
          tokenTimeline.push({ token, timestampMs });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "token",
                content: token,
                timeMs: timestampMs,
              })}\n\n`
            )
          );
          await sleep(tokenDelayMs);
        }

        const timeMs = Date.now() - startTime;
        await persistResult(timeMs);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", timeMs })}\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: withCors({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      }),
    });
  } catch (error: any) {
    console.error("[Stream API] Fatal error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        debug: { challengeId, dailyId, isDaily, modelId },
      }),
      {
        status: 502,
        headers: withCors({ "Content-Type": "application/json" }),
      }
    );
  }
}

function buildTokenTimeline(result: RunResult) {
  if (result.tokenTimeline?.length) {
    return result.tokenTimeline.map((entry) => ({
      token: entry.token,
      timestampMs: Math.max(0, Math.round(entry.timestampMs)),
    }));
  }

  const keystrokes = cleanKeystrokes(result.keystrokes);
  const chars = keystrokes.split("");

  if (chars.length === 0) return [];

  const step =
    result.timeMs && result.timeMs > 0
      ? Math.max(10, Math.round(result.timeMs / Math.max(chars.length, 1)))
      : 15; // enforce a perceptible cadence for derived timelines

  let current = 0;
  return chars.map((token, index) => {
    if (index > 0) {
      current += step;
    }
    return { token, timestampMs: current };
  });
}

function streamFromCachedSolution(result: RunResult) {
  const encoder = new TextEncoder();
  const timeline = buildTokenTimeline(result);
  const totalTime =
    result.timeMs && result.timeMs > 0
      ? result.timeMs
      : timeline.at(-1)?.timestampMs ?? 0;

  const stream = new ReadableStream({
    async start(controller) {
      let lastTs = 0;
      for (const event of timeline) {
        const delay = Math.max(10, event.timestampMs - lastTs); // ensure visible token pacing from cache
        if (delay > 0) {
          await sleep(delay);
        }
        lastTs = event.timestampMs;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "token",
              content: event.token,
              timeMs: event.timestampMs,
              source: "cache",
            })}\n\n`
          )
        );
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "done",
            timeMs: totalTime,
            source: "cache",
          })}\n\n`
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: withCors({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    }),
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
