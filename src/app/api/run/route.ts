import { type NextRequest, NextResponse } from "next/server";
import { callAIGateway, availableModels } from "@/lib/ai-gateway";
import { VimSimulator } from "@/lib/vim-simulator";
import type { RunResult } from "@/lib/types";
import { getOfflineSolution } from "@/lib/offline-library";
import { isDefaultChallengeId } from "@/lib/challenge-source";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startText,
      targetText,
      modelIds,
      bestHumanScore,
      challengeId,
      apiKey,
    } = body;
    const systemApiKey = process.env.AI_GATEWAY_API_KEY;

    if (!startText || !targetText || !modelIds || modelIds.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const results: RunResult[] = [];
    const store = challengeId ? (await import("@/lib/store")).store : null;
    const isDefault = challengeId ? isDefaultChallengeId(challengeId) : false;
    const persistResult = async (result: RunResult) => {
      if (!store || !challengeId) return;
      const existing = await store.getResult(challengeId, result.modelId);
      if (existing) return;
      await store.saveResult(challengeId, result);
    };

    for (const modelId of modelIds) {
      const model = availableModels.find((m) => m.id === modelId);
      if (!model) continue;

      const stored =
        challengeId && store
          ? await store.getResult(challengeId as string, modelId)
          : undefined;
      const cachedOffline =
        challengeId && getOfflineSolution(challengeId as string, modelId);
      const cached = stored || cachedOffline;

      if (isDefault) {
        if (cached) {
          console.log(
            `[run] default cache hit challenge=${challengeId} model=${modelId} source=${
              stored ? "db" : "offline"
            }`
          );
          const keystrokeCount =
            cached.keystrokeCount || countKeystrokes(cached.keystrokes || "");
          const diffFromBest =
            typeof bestHumanScore === "number"
              ? keystrokeCount - bestHumanScore
              : cached.diffFromBest ?? 0;

          const result: RunResult = {
            ...cached,
            modelId: cached.modelId || modelId,
            modelName: cached.modelName || model.name,
            keystrokeCount,
            diffFromBest,
          };
          const hydrated = hydrateSteps(result, startText);
          results.push(hydrated);
          continue;
        }

        const effectiveApiKey = apiKey || systemApiKey;
        if (!effectiveApiKey) {
          console.warn(
            `[run] default cache miss challenge=${challengeId} model=${modelId} (apiKey required for first run)`
          );
          return NextResponse.json(
            {
              error:
                "apiKey is required to generate a new solution for default challenges (pass apiKey or set AI_GATEWAY_API_KEY)",
            },
            { status: 401 }
          );
        }
        console.log(
          `[run] default cache miss, invoking AI gateway challenge=${challengeId} model=${modelId}`
        );
      }

      // Custom challenges must provide an API key
      const effectiveApiKey = apiKey || systemApiKey;
      if (!effectiveApiKey) {
        return NextResponse.json(
          {
            error:
              "apiKey is required for custom challenges (pass apiKey or set AI_GATEWAY_API_KEY)",
          },
          { status: 401 }
        );
      }

      if (cached) {
        console.log(
          `[run] custom cache hit challenge=${challengeId} model=${modelId} source=${
            stored ? "db" : "offline"
          }`
        );
        const keystrokeCount =
          cached.keystrokeCount || countKeystrokes(cached.keystrokes || "");
        const diffFromBest =
          typeof bestHumanScore === "number"
            ? keystrokeCount - bestHumanScore
            : cached.diffFromBest ?? 0;

        const result: RunResult = {
          ...cached,
          modelName: cached.modelName || model.name,
          keystrokeCount,
          diffFromBest,
        };
        const hydrated = hydrateSteps(result, startText);
        results.push(hydrated);
        await persistResult(hydrated);
        continue;
      }

      const startTime = performance.now();

      try {
        console.log(
          `[run] invoking AI gateway challenge=${
            challengeId ?? "custom"
          } model=${modelId}`
        );
        const keystrokes = await callAIGateway(
          modelId,
          startText,
          targetText,
          effectiveApiKey
        );
        const endTime = performance.now();

        const simulator = new VimSimulator(startText);
        simulator.executeKeystrokes(keystrokes);
        const finalText = simulator.getText();
        const steps = simulator.getSteps();

        const success = normalizeText(finalText) === normalizeText(targetText);
        const keystrokeCount = countKeystrokes(keystrokes);
        const diffFromBest =
          typeof bestHumanScore === "number"
            ? keystrokeCount - bestHumanScore
            : keystrokeCount;

        const result: RunResult = {
          modelId,
          modelName: model.name,
          keystrokes,
          keystrokeCount,
          timeMs: Math.round(endTime - startTime),
          success,
          finalText,
          steps,
          diffFromBest,
        };
        results.push(result);
        await persistResult(result);
      } catch (error) {
        console.error(`Error running model ${modelId}:`, error);
        const result: RunResult = {
          modelId,
          modelName: model.name,
          keystrokes: "",
          keystrokeCount: 0,
          timeMs: 0,
          success: false,
          finalText: startText,
          steps: [],
          diffFromBest: 999,
        };
        results.push(result);
        await persistResult(result);
      }
    }

    results.sort((a, b) => {
      if (a.success !== b.success) return a.success ? -1 : 1;
      if (a.keystrokeCount !== b.keystrokeCount)
        return a.keystrokeCount - b.keystrokeCount;
      return a.timeMs - b.timeMs;
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Run error:", error);
    return NextResponse.json(
      { error: "Failed to run challenge" },
      { status: 500 }
    );
  }
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

function countKeystrokes(keystrokes: string): number {
  let count = 0;
  let i = 0;
  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i);
      if (end !== -1) {
        count++;
        i = end + 1;
        continue;
      }
    }
    count++;
    i++;
  }
  return count;
}

function hydrateSteps(result: RunResult, startText: string): RunResult {
  if (result.steps?.length) return result;
  if (!result.keystrokes || !startText) {
    return { ...result, steps: [] };
  }
  try {
    const simulator = new VimSimulator(startText);
    simulator.executeKeystrokes(result.keystrokes);
    return { ...result, steps: simulator.getSteps() };
  } catch (error) {
    console.warn(
      `[run] failed to regenerate steps for ${result.modelId}:`,
      error
    );
    return { ...result, steps: [] };
  }
}
