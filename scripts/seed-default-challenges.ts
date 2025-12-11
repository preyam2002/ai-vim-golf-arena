import { cleanKeystrokes } from "../src/lib/ai-gateway";
import {
  isDefaultChallengeId,
  listAllDefaultChallenges,
} from "../src/lib/challenge-source";
import { getOfflineSolutions } from "../src/lib/offline-library";
import type { RunResult, TokenTimelineEntry } from "../src/lib/types";
import { store } from "../src/lib/store";

function deriveTimeline(result: RunResult): TokenTimelineEntry[] {
  if (result.tokenTimeline?.length) return result.tokenTimeline;
  const keys = cleanKeystrokes(result.keystrokes || "");
  const chars = keys.split("");
  if (chars.length === 0) return [];
  const step =
    result.timeMs && result.timeMs > 0
      ? Math.max(1, Math.round(result.timeMs / chars.length))
      : 10;
  let current = 0;
  return chars.map((token, index) => {
    if (index > 0) current += step;
    return { token, timestampMs: current };
  });
}

function withDerivedFields(result: RunResult): RunResult {
  const keystrokes = cleanKeystrokes(result.keystrokes || "");
  const keystrokeCount =
    result.keystrokeCount && result.keystrokeCount > 0
      ? result.keystrokeCount
      : keystrokes.length;
  const timeMs = result.timeMs ?? 0;
  return {
    ...result,
    keystrokes,
    keystrokeCount,
    timeMs,
    tokenTimeline: deriveTimeline({ ...result, keystrokes, timeMs }),
  };
}

async function main() {
  const challenges = listAllDefaultChallenges();
  console.log(`Seeding ${challenges.length} default challenges...`);

  for (const challenge of challenges) {
    if (!isDefaultChallengeId(challenge.id)) continue;
    await store.saveChallenge(challenge);
    await store.saveBestHumanScore(challenge.id, challenge.bestHumanScore);

    const solutions = getOfflineSolutions(challenge.id);
    if (!solutions) continue;
    const entries = Object.entries(solutions);
    for (const [modelId, result] of entries) {
      const normalized = withDerivedFields({
        ...result,
        modelId,
        modelName: result.modelName || modelId,
      });
      await store.saveResult(challenge.id, normalized);
    }
  }

  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});



