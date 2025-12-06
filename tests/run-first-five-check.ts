import fs from "fs";
import path from "path";
import { listOfflineChallenges } from "../src/lib/offline-library";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";

type ModelResults = Record<
  string,
  { keystrokes: string; keystrokeCount: number }
>;

const challenges = listOfflineChallenges(5);
const challengeMap = new Map(challenges.map((c) => [c.id, c]));
const dbPath = path.join(process.cwd(), "data", "db-first-five.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

type EvalRow = {
  challengeId: string;
  modelId: string;
  success: boolean;
  storedSuccess: boolean | undefined;
  keystrokeCount: number;
  diffFromBest?: number;
  note?: string;
};

const rows: EvalRow[] = [];
const MAX_TOKENS = 10_000;

for (const [challengeId, models] of Object.entries(
  (db as any).results as Record<string, ModelResults>
)) {
  const challenge = challengeMap.get(challengeId);
  if (!challenge) {
    rows.push({
      challengeId,
      modelId: "all",
      success: false,
      storedSuccess: false,
      keystrokeCount: 0,
      note: "challenge metadata missing",
    });
    continue;
  }

  for (const [modelId, result] of Object.entries(models)) {
    let state = createInitialState(challenge.startText);
    let success = false;
    let note: string | undefined;

    if (result.keystrokeCount > 5000) {
      rows.push({
        challengeId,
        modelId,
        success: false,
        storedSuccess: (result as any).success,
        keystrokeCount: result.keystrokeCount,
        diffFromBest: (result as any).diffFromBest,
        note: `skipped execution (keystrokes=${result.keystrokeCount})`,
      });
      continue;
    }

    try {
      const tokens = tokenizeKeystrokes(result.keystrokes, MAX_TOKENS + 1);
      if (tokens.length > MAX_TOKENS) {
        note = `token limit exceeded (${tokens.length})`;
      }
      for (const token of tokens.slice(0, MAX_TOKENS)) {
        state = executeKeystroke(state, token);
      }
      const finalText = state.lines.join("\n");
      success =
        normalizeText(finalText) === normalizeText(challenge.targetText);
      if (!success && !note) {
        note = "final text mismatch";
      }
      if (!note && tokens.length > MAX_TOKENS) {
        note = `token limit exceeded (${tokens.length})`;
      }
    } catch (error: any) {
      note = `error: ${String(error)}`;
      success = false;
    }

    rows.push({
      challengeId,
      modelId,
      success,
      storedSuccess: (result as any).success,
      keystrokeCount: result.keystrokeCount,
      diffFromBest: (result as any).diffFromBest,
      note,
    });
  }
}

console.table(rows);
