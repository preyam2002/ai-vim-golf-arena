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

const MAX_TOKENS = 200_000;

function runWithEngine(
  startText: string,
  targetText: string,
  keystrokes: string
) {
  try {
    const tokens = tokenizeKeystrokes(keystrokes);
    // Limit tokens to avoid infinite loops if any
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

for (const challengeId of Object.keys(db.results)) {
  const challenge = challengeMap.get(challengeId);
  if (!challenge) continue;

  const modelResults = db.results[challengeId];
  for (const modelId of Object.keys(modelResults)) {
    const res = modelResults[modelId];
    // Only update if we have keystrokes
    if (!res.keystrokes) continue;

    const { finalText, success } = runWithEngine(
      challenge.startText,
      challenge.targetText,
      res.keystrokes
    );

    // Update if different
    if (res.success !== success || res.finalText !== finalText) {
      console.log(`[Sync] Updating ${challengeId} / ${modelId}`);
      console.log(`  Old Success: ${res.success}, New: ${success}`);
      console.log(
        `  Old Len: ${res.finalText?.length}, New: ${finalText.length}`
      );

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
