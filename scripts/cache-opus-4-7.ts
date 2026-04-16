import * as fs from "node:fs";
import * as path from "node:path";

for (const line of fs
  .readFileSync(path.resolve(process.cwd(), ".env"), "utf8")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

import { callAIGateway, cleanKeystrokes } from "../src/lib/ai-gateway";
import {
  countKeystrokes,
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
} from "../src/lib/vim-engine";

const CHALLENGE_ID = "9v00674f1bfb00000000063d";
const MODEL_ID = "claude-opus-4-7";
const START =
  "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n";
const TARGET =
  "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC=\n";

function simulate(keystrokes: string, startText: string) {
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

async function main() {
  console.log("Calling gateway with model:", MODEL_ID);
  const t0 = Date.now();
  const raw = await callAIGateway(MODEL_ID, START, TARGET);
  const elapsed = Date.now() - t0;
  const cleaned = cleanKeystrokes(raw);
  const final = simulate(cleaned, START);
  const ok = normalizeText(final) === normalizeText(TARGET);
  const count = countKeystrokes(cleaned);
  console.log("elapsed ms:", elapsed);
  console.log("keystrokes:", JSON.stringify(cleaned));
  console.log("count:", count, "ok:", ok);
  if (!ok) {
    console.error("NOT EQUAL. final:", JSON.stringify(final));
    process.exitCode = 1;
    return;
  }

  const solutionsPath = path.resolve(
    process.cwd(),
    "data/challenge-solutions.json"
  );
  const solutions = JSON.parse(fs.readFileSync(solutionsPath, "utf8"));
  solutions[CHALLENGE_ID] = solutions[CHALLENGE_ID] || {};
  const BEST_HUMAN = 16;
  solutions[CHALLENGE_ID][MODEL_ID] = {
    modelId: MODEL_ID,
    modelName: "Claude Opus 4.7",
    keystrokes: cleaned,
    keystrokeCount: count,
    timeMs: elapsed,
    success: true,
    finalText: "",
    diffFromBest: Math.max(0, count - BEST_HUMAN),
    steps: [],
  };
  fs.writeFileSync(solutionsPath, JSON.stringify(solutions, null, 2));
  console.log("updated cache with real time.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
