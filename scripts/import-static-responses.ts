#!/usr/bin/env npx ts-node
/**
 * Import static challenge responses into challenge-solutions.json.
 *
 * Usage:
 *   npx tsx scripts/import-static-responses.ts
 *   FORCE=true npx tsx scripts/import-static-responses.ts
 *
 * Reads: data/cursor-responses/static-{N}-{modelId}.txt
 */

import fs from "fs";
import path from "path";

import existingSolutions from "../data/challenge-solutions.json";
import { staticChallenges } from "../src/lib/static-challenges";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
  countKeystrokes,
} from "../src/lib/vim-engine";

type SolutionMap = Record<string, Record<string, unknown>>;

const RESPONSES_DIR = path.join(process.cwd(), "data", "cursor-responses");
const SOLUTIONS_PATH = path.join(process.cwd(), "data", "challenge-solutions.json");
const FORCE = process.env.FORCE === "true";

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "gpt-5-4": "GPT-5.4 High",
  "codex-5-3": "Codex 5.3 High",
  "codex-5-2": "Codex 5.2 High",
  "gemini-3-1-pro": "Gemini 3.1 Pro",
  "grok-4": "Grok 4",
  "kimi-k2-5": "Kimi K2.5",
  "composer-2": "Composer 2",
};

function cleanKeystrokes(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^(keystrokes?:?\s*)/i, "");
  cleaned = cleaned.replace(/^```[\w]*\n?/, "").replace(/```$/, "").trim();
  return cleaned;
}

function replayKeystrokes(startText: string, keystrokes: string): string {
  let state = createInitialState(startText);
  let remaining = keystrokes;
  while (remaining.length > 0) {
    const { keystroke, rest } = extractKeystroke(remaining);
    state = executeKeystroke(state, keystroke);
    remaining = rest;
  }
  return state.lines.join("\n");
}

function main() {
  const files = fs.readdirSync(RESPONSES_DIR)
    .filter(f => f.match(/^static-\d+-(.+)\.txt$/))
    .sort();

  if (files.length === 0) {
    console.log("No static response files found (expected: static-N-modelId.txt)");
    return;
  }

  console.log(`Found ${files.length} static response files\n`);

  const challengeMap = new Map(staticChallenges.map(c => [c.id, c]));
  const solutionMap: SolutionMap = { ...(existingSolutions as SolutionMap) };

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const match = file.match(/^(static-\d+)-(.+)\.txt$/);
    if (!match) { skipped++; continue; }

    const [, challengeId, modelId] = match;
    const challenge = challengeMap.get(challengeId);
    if (!challenge) {
      console.warn(`[skip] Unknown challenge: ${challengeId}`);
      skipped++;
      continue;
    }

    if (!FORCE && (solutionMap[challengeId] as Record<string, unknown>)?.[modelId]) {
      console.log(`[exists] ${file} — use FORCE=true to overwrite`);
      skipped++;
      continue;
    }

    const raw = fs.readFileSync(path.join(RESPONSES_DIR, file), "utf-8").trim();
    const lines = raw.split("\n");

    let timeMs = 0;
    let keystrokeRaw = raw;
    if (lines[0].startsWith("time:")) {
      timeMs = parseInt(lines[0].replace("time:", "").trim(), 10) || 0;
      keystrokeRaw = lines.slice(1).join("\n");
    }

    const keystrokes = cleanKeystrokes(keystrokeRaw);
    if (!keystrokes) {
      console.error(`[empty] ${file} — no keystrokes`);
      failed++;
      continue;
    }

    let finalText = "";
    let success = false;
    try {
      finalText = replayKeystrokes(challenge.startText, keystrokes);
      success = normalizeText(finalText) === normalizeText(challenge.targetText);
    } catch {
      success = false;
    }

    const keystrokeCount = countKeystrokes(keystrokes);
    const tag = success ? "ok" : "FAIL";
    const overTag = challenge.bestHumanScore
      ? ` (${keystrokeCount - challenge.bestHumanScore > 0 ? "+" : ""}${keystrokeCount - challenge.bestHumanScore} vs human)`
      : "";

    console.log(`[${tag}] ${challengeId}-${modelId}: ${keystrokeCount} keys${overTag} — ${challenge.title}`);

    if (!solutionMap[challengeId]) solutionMap[challengeId] = {};
    (solutionMap[challengeId] as Record<string, unknown>)[modelId] = {
      modelId,
      modelName: MODEL_NAMES[modelId] || modelId,
      keystrokes,
      keystrokeCount,
      timeMs,
      success,
      finalText,
      steps: [],
      diffFromBest: keystrokeCount - (challenge.bestHumanScore || 0),
    };
    imported++;
  }

  fs.writeFileSync(SOLUTIONS_PATH, JSON.stringify(solutionMap, null, 2));

  console.log(`\n--- Summary ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Cache written to data/challenge-solutions.json`);
}

main();
