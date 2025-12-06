import fs from "fs";
import path from "path";
import { availableModels, callAIGateway } from "../src/lib/ai-gateway.ts";
import { VimSimulator } from "../src/lib/vim-simulator.ts";
import { listOfflineChallenges } from "../src/lib/offline-library.ts";
import { store } from "../src/lib/store.ts";
import type { Challenge, RunResult } from "../src/lib/types";

const DEFAULT_COUNT = 5;
const MAX_DB_KEYSTROKES_LENGTH = 200_000; // guard against runaway outputs blowing up db.json
const FULL_KEYS_DIR = path.join(process.cwd(), "data", "solutions-full");

const targetModels =
  process.env.CACHE_MODELS?.split(",")
    .map((m) => m.trim())
    .filter(Boolean) || availableModels.map((m) => m.id);

const targetCount = Number.isFinite(Number(process.env.CACHE_FIRST_N))
  ? Number(process.env.CACHE_FIRST_N)
  : DEFAULT_COUNT;

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
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

async function runChallengeModel(
  challenge: Challenge,
  modelId: string
): Promise<RunResult> {
  const startTime = performance.now();
  const keystrokes = await callAIGateway(
    modelId,
    challenge.startText,
    challenge.targetText
  );
  const endTime = performance.now();

  const simulator = new VimSimulator(challenge.startText);
  simulator.executeKeystrokes(keystrokes);
  const finalText = simulator.getText();
  const steps = simulator.getSteps();

  const success =
    normalizeText(finalText) === normalizeText(challenge.targetText);
  const keystrokeCount = countKeystrokes(keystrokes);
  const diffFromBest = challenge.bestHumanScore
    ? keystrokeCount - challenge.bestHumanScore
    : keystrokeCount;

  return {
    modelId,
    modelName: modelId,
    keystrokes,
    keystrokeCount,
    timeMs: Math.round(endTime - startTime),
    success,
    finalText,
    steps,
    diffFromBest,
  };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function prepareForStore(
  challengeId: string,
  modelId: string,
  result: RunResult
): RunResult {
  const stored: RunResult = {
    ...result,
    steps: [],
  };

  const keyFileName = `${challengeId}-${modelId.replace(
    /[\\/]/g,
    "_"
  )}.keys.txt`;
  ensureDir(FULL_KEYS_DIR);
  try {
    fs.writeFileSync(
      path.join(FULL_KEYS_DIR, keyFileName),
      result.keystrokes,
      "utf-8"
    );
  } catch (err) {
    console.warn(
      `[cache] failed to write full keystrokes for ${challengeId}/${modelId}`,
      err
    );
  }

  if (stored.keystrokes.length > MAX_DB_KEYSTROKES_LENGTH) {
    const originalLength = stored.keystrokes.length;
    stored.keystrokes =
      stored.keystrokes.slice(0, MAX_DB_KEYSTROKES_LENGTH) +
      ` ... [truncated ${originalLength - MAX_DB_KEYSTROKES_LENGTH} chars]`;
  }

  return stored;
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const challenges = listOfflineChallenges(targetCount);
  if (challenges.length === 0) {
    throw new Error("No offline challenges found to cache");
  }

  console.log(
    `Caching first ${
      challenges.length
    } challenges for models: ${targetModels.join(", ")}`
  );

  for (const challenge of challenges) {
    console.log(`\n[challenge] ${challenge.id} - ${challenge.title}`);
    await store.saveChallenge?.(challenge);
    await store.saveBestHumanScore?.(
      challenge.id,
      challenge.bestHumanScore || 0
    );

    for (const modelId of targetModels) {
      try {
        const existing = await store.getResult(challenge.id, modelId);
        if (existing) {
          console.log(
            `[skip] cached ${modelId} (keystrokes=${existing.keystrokeCount})`
          );
          continue;
        }

        const result = await runChallengeModel(challenge, modelId);
        const pruned = prepareForStore(challenge.id, modelId, result);
        await store.saveResult(challenge.id, pruned);
        console.log(
          `[ok] ${modelId} -> ${result.keystrokeCount} keys, ${result.timeMs}ms, success=${result.success}`
        );
      } catch (error) {
        console.error(`[fail] ${modelId} on ${challenge.id}:`, error);
        // Ensure we record a failure entry so we don't keep re-calling the model
        const failureResult: RunResult = {
          modelId,
          modelName: modelId,
          keystrokes: `[error: ${String(error).slice(0, 180)}]`,
          keystrokeCount: 0,
          timeMs: 0,
          success: false,
          finalText: challenge.startText,
          steps: [],
          diffFromBest: 999,
        };
        await store.saveResult(challenge.id, failureResult);
      }
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
