import fs from "fs";
import path from "path";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";

const DB_PATH = path.join(__dirname, "../data/db.json");
const CHALLENGES_PATH = path.join(__dirname, "../data/popular-challenges.json");

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const challenges = JSON.parse(fs.readFileSync(CHALLENGES_PATH, "utf8"));
const challengeMap = new Map(challenges.map((c: any) => [c.id, c]));

const TARGET_IDS = [
  "9v00673faf4c0000000005fb",
  "9v00674f1bfb00000000063d",
  "9v006733c56b0000000005d9",
  "9v0067401f2500000000061b",
  "9v00674fdf8000000000065d",
];

const MAX_TOKENS = 200_000;

function runWithEngine(
  startText: string,
  targetText: string,
  keystrokes: string
) {
  try {
    const tokens = tokenizeKeystrokes(keystrokes);
    const safeTokens = tokens.slice(0, MAX_TOKENS);
    let state = createInitialState(startText);
    for (const token of safeTokens) {
      state = executeKeystroke(state, token);
    }
    const finalText = state.lines.join("\n");
    const success =
      normalizeText(finalText) === normalizeText(targetText ?? "");
    return { finalText, success };
  } catch (e) {
    console.error("Engine crash:", e);
    return { finalText: "", success: false };
  }
}

let changed = 0;

for (const challengeId of TARGET_IDS) {
  const challenge = challengeMap.get(challengeId);
  if (!challenge) continue;

  const modelResults = db.results[challengeId];
  if (!modelResults) continue;

  for (const modelId of Object.keys(modelResults)) {
    const res = modelResults[modelId];
    if (!res.keystrokes) continue;

    console.log(`Processing ${challengeId} / ${modelId}...`);
    const { finalText, success } = runWithEngine(
      challenge.startText,
      challenge.targetText,
      res.keystrokes
    );

    if (res.success !== success || res.finalText !== finalText) {
      console.log(`[Sync] Updating ${challengeId} / ${modelId}`);
      console.log(`  Old Success: ${res.success}, New: ${success}`);

      res.success = success;
      res.finalText = finalText;
      changed++;
    }
  }
}

if (changed > 0) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Updated ${changed} entries in db.json`);
} else {
  console.log("No changes necessary.");
}
