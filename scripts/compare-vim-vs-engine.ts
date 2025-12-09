import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

import type { Challenge, RunResult } from "../src/lib/types";
import {
  createInitialState,
  executeKeystroke,
  normalizeText,
  tokenizeKeystrokes,
} from "../src/lib/vim-engine";
import { staticChallenges } from "../src/lib/static-challenges";
import popularChallenges from "../data/popular-challenges.json";

type ResultEntry = {
  challengeId: string;
  modelId: string;
  status: "ok" | "mismatch" | "skipped" | "error";
  reason?: string;
  engineMatchesTarget?: boolean;
  vimMatchesTarget?: boolean;
  engineTextSnippet?: string;
  vimTextSnippet?: string;
};

const DEFAULT_MAX_TOKENS = 10_000;
const DEFAULT_SKIP_KEYSTROKES = 12_000;

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function buildChallengeMap(): Map<string, Challenge> {
  const map = new Map<string, Challenge>();
  for (const c of staticChallenges) {
    map.set(c.id, c);
  }
  for (const c of popularChallenges as Challenge[]) {
    map.set(c.id, c);
  }
  return map;
}

function runEngine(startText: string, tokens: string[]): string {
  let state = createInitialState(startText);
  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }
  return state.lines.join("\n");
}

function runRealVim(startText: string, tokens: string[], timeoutMs = 20_000) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vim-parity-"));
  const bufferPath = path.join(tmpDir, "buffer.txt");
  const scriptPath = path.join(tmpDir, "driver.vim");

  fs.writeFileSync(bufferPath, startText, "utf8");

  const tokensJson = JSON.stringify(tokens).replace(/'/g, "''");
  const script = [
    "set nocompatible",
    "set backspace=indent,eol,start",
    "set nofixendofline",
    "set fileformat=unix",
    "set noswapfile",
    "set nobackup",
    "set nowritebackup",
    `let g:tokens = json_decode('${tokensJson}')`,
    "for t in g:tokens",
    "  call feedkeys(t, 'xt')",
    "  call feedkeys('', 'x!')",
    "endfor",
    `call feedkeys("\\<Esc>:wq!\\<CR>", "xt")`,
    `call feedkeys('', 'x!')`,
  ].join("\n");

  fs.writeFileSync(scriptPath, script, "utf8");

  const proc = spawnSync(
    "vim",
    ["-Nu", "NONE", "-n", "-Es", "-S", scriptPath, bufferPath],
    {
      encoding: "utf8",
      timeout: timeoutMs,
    }
  );

  let error: string | undefined;
  if (proc.error) {
    error = `spawn error: ${proc.error.message}`;
  } else if (proc.status !== 0) {
    error = `vim exit ${proc.status}: ${proc.stderr || proc.stdout}`;
  }

  let finalText = "";
  try {
    finalText = fs.readFileSync(bufferPath, "utf8");
  } catch (readErr) {
    error = error ?? `read error: ${(readErr as Error).message}`;
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { finalText, error };
}

function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
}

async function main() {
  const challengeFilter =
    process.env.CHALLENGE_ID?.split(",").map((s) => s.trim()) ?? null;
  const maxTokens = Number(process.env.MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const skipKeystrokes = Number(
    process.env.SKIP_KEYSTROKES || DEFAULT_SKIP_KEYSTROKES
  );
  const dbPath =
    process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");

  const challengeMap = buildChallengeMap();
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8")) as {
    results: Record<string, Record<string, RunResult>>;
  };

  const rows: ResultEntry[] = [];
  for (const [challengeId, models] of Object.entries(db.results || {})) {
    if (challengeFilter && !challengeFilter.includes(challengeId)) continue;

    const challenge = challengeMap.get(challengeId);
    if (!challenge) {
      rows.push({
        challengeId,
        modelId: "all",
        status: "error",
        reason: "challenge metadata missing",
      });
      continue;
    }

    for (const [modelId, result] of Object.entries(models)) {
      const keystrokes = result.keystrokes || "";
      if (!keystrokes) {
        rows.push({
          challengeId,
          modelId,
          status: "skipped",
          reason: "no keystrokes",
        });
        continue;
      }

      if (result.keystrokeCount > skipKeystrokes) {
        rows.push({
          challengeId,
          modelId,
          status: "skipped",
          reason: `keystrokes too large (${result.keystrokeCount})`,
        });
        continue;
      }

      const tokens = tokenizeKeystrokes(keystrokes, maxTokens + 1);
      if (tokens.length > maxTokens) {
        rows.push({
          challengeId,
          modelId,
          status: "skipped",
          reason: `token limit exceeded (${tokens.length})`,
        });
        continue;
      }

      const engineText = runEngine(challenge.startText, tokens);
      const vimResult = runRealVim(challenge.startText, tokens);

      if (vimResult.error) {
        rows.push({
          challengeId,
          modelId,
          status: "error",
          reason: vimResult.error,
          engineMatchesTarget:
            normalizeText(engineText) === normalizeText(challenge.targetText),
        });
        continue;
      }

      const engineNormalized = normalizeText(engineText);
      const vimNormalized = normalizeText(vimResult.finalText);
      const targetNormalized = normalizeText(challenge.targetText);

      const engineMatchesTarget = engineNormalized === targetNormalized;
      const vimMatchesTarget = vimNormalized === targetNormalized;

      if (engineNormalized === vimNormalized) {
        rows.push({
          challengeId,
          modelId,
          status: "ok",
          engineMatchesTarget,
          vimMatchesTarget,
        });
      } else {
        rows.push({
          challengeId,
          modelId,
          status: "mismatch",
          engineMatchesTarget,
          vimMatchesTarget,
          engineTextSnippet: snippet(engineText),
          vimTextSnippet: snippet(vimResult.finalText),
          reason: "engine !== real vim",
        });
      }
    }
  }

  const mismatches = rows.filter((r) => r.status === "mismatch");
  const errors = rows.filter((r) => r.status === "error");
  const skipped = rows.filter((r) => r.status === "skipped");
  const ok = rows.filter((r) => r.status === "ok");

  log(`Checked ${rows.length} solutions.`);
  log(
    `ok=${ok.length}, mismatches=${mismatches.length}, errors=${errors.length}, skipped=${skipped.length}`
  );

  if (mismatches.length > 0) {
    log("\nMismatches:");
    console.table(mismatches);
  }
  if (errors.length > 0) {
    log("\nErrors:");
    console.table(errors);
  }
  if (skipped.length > 0) {
    log("\nSkipped:");
    console.table(skipped);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
