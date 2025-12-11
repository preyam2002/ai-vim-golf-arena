import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

import type { Challenge, RunResult } from "../src/lib/types.ts";
import {
  createInitialState,
  executeKeystroke,
  normalizeText,
  tokenizeKeystrokes,
} from "../src/lib/vim-engine.ts";
import { staticChallenges } from "../src/lib/static-challenges.ts";
import popularChallenges from "../data/popular-challenges.json";
import challengeSolutions from "../data/challenge-solutions.json";

type SolutionSource = "db" | "challenge-solutions";

type SolutionRow = {
  source: SolutionSource;
  challengeId: string;
  modelId: string;
  modelName: string;
  keystrokes: string;
  keystrokeCount: number;
};

type ResultEntry = {
  source: SolutionSource;
  challengeId: string;
  modelId: string;
  modelName: string;
  status: "ok" | "mismatch" | "skipped" | "error";
  reason?: string;
  engineMatchesTarget?: boolean;
  vimMatchesTarget?: boolean;
  engineTextSnippet?: string;
  vimTextSnippet?: string;
  artifactDir?: string;
};

const DEFAULT_MAX_TOKENS = 10_000;
const DEFAULT_SKIP_KEYSTROKES = 12_000;

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function buildChallengeMap(): Map<string, Challenge> {
  const map = new Map<string, Challenge>();
  for (const c of staticChallenges) map.set(c.id, c);
  for (const c of popularChallenges as Challenge[]) map.set(c.id, c);
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
    "function! RunKeystrokes()",
    "  for t in g:tokens",
    "    let l:raw = t",
    "    if l:raw =~ '^:'",
    "      let l:cmd = substitute(l:raw[1:], '<CR>', '', 'g')",
    "      try | silent! execute l:cmd | catch /.*/ | let g:vim_parity_err = v:exception | endtry",
    "    elseif l:raw =~ '^/' || l:raw =~ '^?'",
    "      let l:search = substitute(l:raw, '<CR>', '', 'g')",
    "      try | execute l:search | catch /.*/ | let g:vim_parity_err = v:exception | endtry",
    "    else",
    "      let l:keys = replace_termcodes(l:raw, v:true, v:true, v:true)",
    "      call feedkeys(l:keys, 'nx')",
    "      silent! execute 'normal! \\<Esc>'",
    "    endif",
    "  endfor",
    "  silent! write | qa!",
    "endfunction",
  ].join("\n");

  fs.writeFileSync(scriptPath, script, "utf8");

  const proc = spawnSync(
    "vim",
    [
      "-Nu",
      "NONE",
      "-n",
      "-Es",
      "-S",
      scriptPath,
      bufferPath,
      "-c",
      "call RunKeystrokes()",
    ],
    { encoding: "utf8", timeout: timeoutMs }
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

function loadDbSolutions(dbPath: string): SolutionRow[] {
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8")) as {
    results: Record<string, Record<string, RunResult>>;
  };

  const rows: SolutionRow[] = [];
  for (const [challengeId, models] of Object.entries(db.results || {})) {
    for (const [modelId, result] of Object.entries(models)) {
      rows.push({
        source: "db",
        challengeId,
        modelId,
        modelName: result.modelName || modelId,
        keystrokes: result.keystrokes || "",
        keystrokeCount: result.keystrokeCount || result.keystrokes?.length || 0,
      });
    }
  }
  return rows;
}

function loadChallengeSolutionRows(): SolutionRow[] {
  const rows: SolutionRow[] = [];
  for (const [challengeId, solutions] of Object.entries(
    challengeSolutions as Record<
      string,
      Record<
        string,
        {
          modelId: string;
          modelName: string;
          keystrokes: string;
          keystrokeCount: number;
        }
      >
    >
  )) {
    for (const [, entry] of Object.entries(solutions)) {
      rows.push({
        source: "challenge-solutions",
        challengeId,
        modelId: entry.modelId,
        modelName: entry.modelName,
        keystrokes: entry.keystrokes,
        keystrokeCount: entry.keystrokeCount,
      });
    }
  }
  return rows;
}

function writeArtifacts(opts: {
  dir: string;
  challenge: Challenge;
  tokens: string[];
  engineText: string;
  vimText: string;
  source: SolutionSource;
  modelId: string;
  modelName: string;
  keystrokes: string;
}) {
  fs.mkdirSync(opts.dir, { recursive: true });
  fs.writeFileSync(
    path.join(opts.dir, "start.txt"),
    opts.challenge.startText,
    "utf8"
  );
  fs.writeFileSync(
    path.join(opts.dir, "target.txt"),
    opts.challenge.targetText,
    "utf8"
  );
  fs.writeFileSync(
    path.join(opts.dir, "keystrokes.txt"),
    opts.keystrokes,
    "utf8"
  );
  fs.writeFileSync(
    path.join(opts.dir, "tokens.json"),
    JSON.stringify(opts.tokens, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(opts.dir, "engine.txt"), opts.engineText, "utf8");
  fs.writeFileSync(path.join(opts.dir, "vim.txt"), opts.vimText, "utf8");
  fs.writeFileSync(
    path.join(opts.dir, "meta.json"),
    JSON.stringify(
      {
        source: opts.source,
        modelId: opts.modelId,
        modelName: opts.modelName,
      },
      null,
      2
    ),
    "utf8"
  );
}

async function main() {
  const challengeFilter =
    process.env.CHALLENGE_ID?.split(",").map((s) => s.trim()) ?? null;
  const modelFilter =
    process.env.MODEL_ID?.split(",").map((s) => s.trim()) ?? null;
  const maxTokens = Number(process.env.MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const skipKeystrokes = Number(
    process.env.SKIP_KEYSTROKES || DEFAULT_SKIP_KEYSTROKES
  );
  const dbPath =
    process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");
  const saveArtifacts =
    process.env.SAVE_ARTIFACTS === "1" || process.env.SAVE_ARTIFACTS === "true";
  const vimTimeoutMs = Number(process.env.VIM_TIMEOUT_MS || 20_000);
  const artifactsDir =
    process.env.ARTIFACTS_DIR ||
    path.join(process.cwd(), "tmp", "vim-parity-artifacts");

  const challengeMap = buildChallengeMap();
  const allSolutions = [
    ...loadDbSolutions(dbPath),
    ...loadChallengeSolutionRows(),
  ];

  const filteredSolutions = allSolutions.filter((row) => {
    if (challengeFilter && !challengeFilter.includes(row.challengeId)) {
      return false;
    }
    if (modelFilter && !modelFilter.includes(row.modelId)) {
      return false;
    }
    return true;
  });

  log(
    `Loaded ${filteredSolutions.length} solutions (filters: challenge=${
      challengeFilter?.join(",") ?? "all"
    }, model=${modelFilter?.join(",") ?? "all"}).`
  );

  const results: ResultEntry[] = [];

  for (const row of filteredSolutions) {
    const challenge = challengeMap.get(row.challengeId);
    if (!challenge) {
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "error",
        reason: "challenge metadata missing",
      });
      continue;
    }

    if (!row.keystrokes) {
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "skipped",
        reason: "no keystrokes",
      });
      continue;
    }

    if (row.keystrokeCount > skipKeystrokes) {
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "skipped",
        reason: `keystrokes too large (${row.keystrokeCount})`,
      });
      continue;
    }

    const tokens = tokenizeKeystrokes(row.keystrokes, maxTokens + 1);
    if (tokens.length > maxTokens) {
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "skipped",
        reason: `token limit exceeded (${tokens.length})`,
      });
      continue;
    }

    const engineText = runEngine(challenge.startText, tokens);
    const vimResult = runRealVim(challenge.startText, tokens, vimTimeoutMs);

    if (vimResult.error) {
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
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
      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "ok",
        engineMatchesTarget,
        vimMatchesTarget,
      });
    } else {
      const artifactPath = saveArtifacts
        ? path.join(
            artifactsDir,
            sanitize(`${row.challengeId}-${row.source}-${row.modelId}`)
          )
        : undefined;

      if (artifactPath) {
        writeArtifacts({
          dir: artifactPath,
          challenge,
          tokens,
          engineText,
          vimText: vimResult.finalText,
          source: row.source,
          modelId: row.modelId,
          modelName: row.modelName,
          keystrokes: row.keystrokes,
        });
      }

      results.push({
        source: row.source,
        challengeId: row.challengeId,
        modelId: row.modelId,
        modelName: row.modelName,
        status: "mismatch",
        engineMatchesTarget,
        vimMatchesTarget,
        engineTextSnippet: snippet(engineText),
        vimTextSnippet: snippet(vimResult.finalText),
        reason: "engine !== real vim",
        artifactDir: artifactPath,
      });
    }
  }

  const mismatches = results.filter((r) => r.status === "mismatch");
  const errors = results.filter((r) => r.status === "error");
  const skipped = results.filter((r) => r.status === "skipped");
  const ok = results.filter((r) => r.status === "ok");

  log(`Checked ${results.length} solutions.`);
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
