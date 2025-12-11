import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
} from "../src/lib/vim-engine";
import { staticChallenges } from "../src/lib/static-challenges";
import type { Challenge, RunResult } from "../src/lib/types";

type DbShape = {
  results: Record<string, Record<string, RunResult>>;
  cachedChallenges: Record<string, Challenge>;
};

const db: DbShape = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8")
);

const staticIndex = new Map(staticChallenges.map((c) => [c.id, c]));

function getChallenge(id: string): Challenge | null {
  if (staticIndex.has(id)) return staticIndex.get(id) ?? null;
  return db.cachedChallenges[id] ?? null;
}

function replay(startText: string, keystrokes: string): string {
  // Disable history tracking for replay to prevent OOM
  let state = createInitialState(startText, { maxHistorySize: 0 });
  let remaining = keystrokes ?? "";
  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode);
    if (!stroke) break;
    state = executeKeystroke(state, stroke);
    remaining = remaining.slice(stroke.length);
  }
  return state.lines.join("\n");
}

// Build a flat array of test cases
interface TestCase {
  challengeId: string;
  modelId: string;
  startText: string;
  targetText: string;
  result: RunResult;
}

const testCases: TestCase[] = [];
const allTestCases: TestCase[] = [];
for (const [challengeId, models] of Object.entries(db.results)) {
  const ch = getChallenge(challengeId);
  if (!ch) continue;

  for (const [modelId, result] of Object.entries(models)) {
    allTestCases.push({
      challengeId,
      modelId,
      startText: ch.startText,
      targetText: ch.targetText,
      result,
    });
  }
}
testCases.push(...allTestCases);

// Enable Real Vim for this suite
process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

import { runVimParityAsync } from "../src/lib/vim-parity";

describe("replay all cached results (Strict Parity)", () => {
  // Use sequential execution to avoid spawning too many nvim processes if the semaphore isn't strict enough
  // or allow vitest to handle it.

  testCases
    // .filter((tc) => tc.challengeId === "static-7")
    .forEach(({ challengeId, modelId, startText, result }) => {
      it(`challenge ${challengeId} - ${modelId}`, async () => {
        // Run comparison
        const parityResult = await runVimParityAsync({
          startText,
          keystrokes: result.keystrokes,
          vimBin: "nvim",
          timeoutMs: 2000,
        });

        // The User's Requirement: "pass the tests if both commands returns the same output"
        // This asserts STRICT PARITY.
        if (parityResult.engineNormalized !== parityResult.vimNormalized) {
          console.log(`Mismatch ${challengeId} ${modelId}`);
          console.log("Engine:", JSON.stringify(parityResult.engineNormalized));
          console.log("Vim:   ", JSON.stringify(parityResult.vimNormalized));
        }
        expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
      });
    });
});
