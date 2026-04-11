#!/usr/bin/env npx ts-node
/**
 * Import responses from Cursor / web chat into the offline cache.
 *
 * Usage:
 *   npx tsx scripts/import-cursor-responses.ts
 *   FORCE=true npx tsx scripts/import-cursor-responses.ts   # overwrite existing
 *
 * Reads:
 *   data/cursor-responses/{NUMBER}-{modelId}.txt
 *     e.g. 01-gpt-4o.txt, 03-claude-3.5-sonnet.txt
 *
 * Each file should contain the raw Vim keystrokes the model returned.
 * Cleans, validates via VimSimulator, and writes to challenge-solutions.json.
 */

import fs from "fs";
import path from "path";

import challenges from "../data/popular-challenges.json";
import existingSolutions from "../data/challenge-solutions.json";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
  countKeystrokes,
} from "../src/lib/vim-engine";

interface Challenge {
  id: string;
  title: string;
  startText: string;
  targetText: string;
  bestHumanScore: number;
}

interface RunResult {
  modelId: string;
  modelName: string;
  keystrokes: string;
  keystrokeCount: number;
  timeMs: number;
  success: boolean;
  finalText: string;
  steps: unknown[];
  diffFromBest: number;
  tokenTimeline?: { token: string; timestampMs: number }[];
}

type SolutionMap = Record<string, Record<string, RunResult>>;

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "gpt-5-4": "GPT-5.4",
  "gpt-5-4-mini": "GPT-5.4 Mini",
  "codex-5-3": "Codex 5.3",
  "codex-5-2": "Codex 5.2",
  "gemini-3-1-pro": "Gemini 3.1 Pro",
  "grok-4": "Grok 4",
  "kimi-k2-5": "Kimi K2.5",
  "composer-2": "Composer 2",
};

const RESPONSES_DIR = path.join(process.cwd(), "data", "cursor-responses");
const INDEX_PATH = path.join(process.cwd(), "data", "cursor-prompts", "index.json");
const SOLUTIONS_PATH = path.join(process.cwd(), "data", "challenge-solutions.json");

const FORCE = process.env.FORCE === "true";

/**
 * Parse optional "time: 3500" or "time: 3.5s" header from response file.
 * Returns { timeMs, body } where body is the rest of the file.
 */
function parseTimeHeader(raw: string): { timeMs: number; body: string } {
  const lines = raw.split("\n");
  const first = lines[0].trim();
  const match = first.match(/^time:\s*([\d.]+)\s*(ms|s)?$/i);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = (match[2] || "ms").toLowerCase();
    const timeMs = unit === "s" ? Math.round(value * 1000) : Math.round(value);
    return { timeMs, body: lines.slice(1).join("\n") };
  }
  return { timeMs: 0, body: raw };
}

function cleanKeystrokes(raw: string): string {
  let cleaned = raw.trim();

  // Extract from markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:vim|text)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  } else if (cleaned.startsWith("`") && cleaned.endsWith("`")) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove "keystrokes:" prefix
  cleaned = cleaned.replace(/^(keystrokes?:?\s*)/i, "");

  // Remove wrapping quotes
  cleaned = cleaned.replace(/^['"]|['"]$/g, "");

  return cleaned.trim();
}

function replayKeystrokes(startText: string, keystrokes: string): string {
  let state = createInitialState(startText);
  let remaining = keystrokes;

  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode);
    if (!stroke) break;
    state = executeKeystroke(state, stroke);
    remaining = remaining.slice(stroke.length);
  }

  return state.lines.join("\n");
}

function buildTokenTimeline(
  keystrokes: string,
  totalTimeMs: number
): { token: string; timestampMs: number }[] {
  const tokens = keystrokes.split("");
  if (tokens.length === 0) return [];
  const delay = totalTimeMs > 0
    ? totalTimeMs / tokens.length
    : Math.max(1, Math.min(10, Math.floor(500 / tokens.length)));
  return tokens.map((token, i) => ({
    token,
    timestampMs: Math.round(i * delay),
  }));
}

function parseResponseFilename(
  filename: string
): { num: string; modelId: string } | null {
  const match = filename.match(/^(\d+)-(.+)\.txt$/);
  if (!match) return null;
  return { num: match[1], modelId: match[2] };
}

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error("Run generate-cursor-prompts.ts first to create the index.");
    process.exit(1);
  }

  if (!fs.existsSync(RESPONSES_DIR)) {
    console.error(`No responses directory at ${RESPONSES_DIR}`);
    console.error("Create it and add response files: data/cursor-responses/{num}-{model-id}.txt");
    process.exit(1);
  }

  const index: Record<string, { challengeId: string; title: string }> = JSON.parse(
    fs.readFileSync(INDEX_PATH, "utf-8")
  );
  const challengeMap = new Map(
    (challenges as Challenge[]).map((c) => [c.id, c])
  );
  const solutionMap: SolutionMap = (existingSolutions as SolutionMap) || {};

  const files = fs
    .readdirSync(RESPONSES_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  if (files.length === 0) {
    console.log("No response files found in data/cursor-responses/");
    console.log("Expected format: {number}-{model-id}.txt (e.g., 01-gpt-4o.txt)");
    process.exit(0);
  }

  console.log(`Found ${files.length} response files\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const parsed = parseResponseFilename(file);
    if (!parsed) {
      console.warn(`[skip] Unrecognized filename: ${file}`);
      skipped++;
      continue;
    }

    const { num, modelId } = parsed;
    const entry = index[num];
    if (!entry) {
      console.warn(`[skip] No challenge mapped to number ${num} (file: ${file})`);
      skipped++;
      continue;
    }

    const challenge = challengeMap.get(entry.challengeId);
    if (!challenge) {
      console.warn(`[skip] Challenge ${entry.challengeId} not found (file: ${file})`);
      skipped++;
      continue;
    }

    const modelName = MODEL_NAMES[modelId] || modelId;

    // Check existing
    if (!FORCE && solutionMap[challenge.id]?.[modelId]) {
      console.log(`[exists] ${num}-${modelId} — use FORCE=true to overwrite`);
      skipped++;
      continue;
    }

    // Read and clean keystrokes
    const raw = fs.readFileSync(path.join(RESPONSES_DIR, file), "utf-8");
    const { timeMs: parsedTimeMs, body } = parseTimeHeader(raw);
    const cleaned = cleanKeystrokes(body);

    if (!cleaned.trim()) {
      console.error(`[empty] ${file} — no keystrokes after cleaning`);
      failed++;
      continue;
    }

    // Validate by replaying keystrokes
    let finalText: string;
    let success: boolean;
    try {
      finalText = replayKeystrokes(challenge.startText, cleaned);
      success = normalizeText(finalText) === normalizeText(challenge.targetText);
    } catch (e) {
      console.error(`[error] ${file} — replay failed: ${e}`);
      finalText = "";
      success = false;
    }

    const keystrokeCount = countKeystrokes(cleaned);
    const result: RunResult = {
      modelId,
      modelName,
      keystrokes: cleaned,
      keystrokeCount,
      timeMs: parsedTimeMs,
      success,
      finalText: "",
      steps: [],
      diffFromBest: keystrokeCount - (challenge.bestHumanScore || 0),
      tokenTimeline: buildTokenTimeline(cleaned, parsedTimeMs),
    };

    solutionMap[challenge.id] ||= {};
    const wasExisting = !!solutionMap[challenge.id][modelId];
    solutionMap[challenge.id][modelId] = result;

    const tag = success ? "ok" : "FAIL";
    const overTag = wasExisting ? " [overwritten]" : "";
    const timeTag = parsedTimeMs > 0 ? `, ${parsedTimeMs}ms` : ", no time";
    console.log(
      `[${tag}] ${num}-${modelId}: ${keystrokeCount} keys${timeTag}${overTag} — ${entry.title}`
    );

    imported++;
  }

  // Persist
  fs.writeFileSync(SOLUTIONS_PATH, JSON.stringify(solutionMap, null, 2) + "\n");

  console.log("\n--- Summary ---");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Cache written to data/challenge-solutions.json`);
}

main();
