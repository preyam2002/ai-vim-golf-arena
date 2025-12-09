import { describe, expect, test } from "vitest";
import fs from "fs";
import path from "path";
import { listOfflineChallenges } from "../src/lib/offline-library";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";
import type { RunResult } from "../src/lib/types";

const db = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/db-first-five.json"), "utf-8")
);
const firstFive = listOfflineChallenges(5);
const challengeById = new Map(firstFive.map((c) => [c.id, c]));
const MAX_TOKENS = 100_000;
const MAX_TEST_TIMEOUT_MS = 20_000;

function runWithEngine(
  startText: string,
  targetText: string,
  keystrokes: string
) {
  let state = createInitialState(startText);
  for (const token of tokenizeKeystrokes(keystrokes, MAX_TOKENS)) {
    state = executeKeystroke(state, token);
  }
  const finalText = state.lines.join("\n");
  const success = normalizeText(finalText) === normalizeText(targetText ?? "");
  return { finalText, success };
}

describe("cached solutions for first five challenges", () => {
  const results = (db as any).results as Record<
    string,
    Record<string, RunResult>
  >;

  for (const [challengeId, modelResults] of Object.entries(results)) {
    const challenge = challengeById.get(challengeId);
    if (!challenge) continue;

    describe(`challenge ${challengeId} - ${challenge.title}`, () => {
      for (const [modelId, result] of Object.entries(modelResults)) {
        test(`model ${modelId}`, { timeout: MAX_TEST_TIMEOUT_MS }, () => {
          const expectedSuccess = result.success !== false;
          const { success } = runWithEngine(
            challenge.startText,
            challenge.targetText,
            result.keystrokes
          );

          expect(success).toBe(expectedSuccess);
        });
      }
    });
  }
});
