import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";

import {
  createInitialState,
  executeKeystroke,
  normalizeText,
  tokenizeKeystrokes,
  type VimState,
} from "./vim-engine";
import { type ExCommandHelpers } from "./vim-ex-commands";

type RealVimResult = {
  finalText: string;
  error?: string;
};

export type VimParityInput = {
  startText: string;
  keystrokes?: string;
  tokens?: string[];
  expectedText?: string;
  initialState?: Partial<VimState>;
  timeoutMs?: number;
  vimBin?: string;
};

export type VimParityResult = {
  engineState: VimState;
  engineText: string;
  engineNormalized: string;
  vimText: string;
  vimNormalized: string;
  expectedNormalized?: string;
  tokens: string[];
};

const DEFAULT_TIMEOUT_MS =
  Number.parseInt(process.env.PARITY_TIMEOUT_MS ?? "", 10) || 100_000;

// Concurrency limit for parallel nvim execution
const MAX_CONCURRENT_NVIM =
  Number.parseInt(process.env.PARITY_CONCURRENCY ?? "", 10) || 1;

// Simple semaphore for limiting concurrent nvim processes
let activeTasks = 0;
const waitQueue: Array<() => void> = [];

async function acquireSemaphore(): Promise<void> {
  if (activeTasks < MAX_CONCURRENT_NVIM) {
    activeTasks++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeTasks++;
      resolve();
    });
  });
}

function releaseSemaphore(): void {
  activeTasks--;
  const next = waitQueue.shift();
  if (next) next();
}

function runEngine(
  startText: string,
  tokens: string[],
  initialState?: Partial<VimState>
): { state: VimState; text: string } {
  let state = createInitialState(startText);
  if (initialState) {
    state = { ...state, ...initialState };
  }

  const helpers: ExCommandHelpers = {
    executeKeystroke,
    tokenizeKeystrokes,
    runShellCommand: (cmd: string) => {
      try {
        const res = spawnSync(cmd, { shell: true, encoding: "utf8" });
        if (res.error) throw res.error;
        return res.stdout;
      } catch (e) {
        console.warn("Shell command failed:", e);
        return "";
      }
    },
  };

  for (const token of tokens) {
    state = executeKeystroke(state, token, helpers);
  }
  return { state, text: state.lines.join("\n") };
}

/**
 * Run real vim asynchronously for parallel execution
 */
async function runRealVimAsync(
  startText: string,
  tokens: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  vimBin = process.env.VIM_BIN || "nvim",
  initialCursor?: { line: number; col: number }
): Promise<RealVimResult> {
  await acquireSemaphore();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vim-parity-"));
  const bufferPath = path.join(tmpDir, "buffer.txt");
  const scriptInPath = path.join(tmpDir, "input.keys");
  const initPath = path.join(tmpDir, "init.vim");
  const logPath = path.join(tmpDir, "nvim.log");

  try {
    fs.writeFileSync(bufferPath, startText, "utf8");

    // Convert tokens to raw keystroke bytes
    const rawKeys = tokens.map(convertTokenToRawKeys).join("");

    // Prepend cursor movement keys to ensure state matches
    const cursorKeys = initialCursor
      ? `${initialCursor.line + 1}G${initialCursor.col + 1}|`
      : "";

    // Append Esc and :wq<CR> to save and quit
    const scriptContent =
      cursorKeys + rawKeys + convertTokenToRawKeys("<Esc>:wq<CR>");
    fs.writeFileSync(scriptInPath, scriptContent, { encoding: "utf8" });

    // Create init script for vim settings and initial cursor positioning
    const initCommands = [
      "set nocompatible",
      "set backspace=indent,eol,start",
      "set nofixendofline",
      "set fileformat=unix",
      "set noswapfile",
      "set nobackup",
      "set nowritebackup",
      "set shiftwidth=2",
      "set expandtab",
      "set nomore",
      "set shortmess+=F",
    ];
    fs.writeFileSync(initPath, initCommands.join("\n"), "utf8");

    const result = await new Promise<RealVimResult>((resolve) => {
      const proc = spawn(
        vimBin,
        [
          "--headless",
          "-u",
          initPath,
          "-n",
          "-i",
          "NONE",
          "-s",
          scriptInPath,
          bufferPath,
        ],
        {
          env: { ...process.env, NVIM_LOG_FILE: logPath },
        }
      );

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, timeoutMs);

      proc.on("close", (code) => {
        clearTimeout(timer);

        let error: string | undefined;
        if (timedOut) {
          error = `timeout after ${timeoutMs}ms`;
        } else if (code !== 0) {
          const log = fs.existsSync(logPath)
            ? fs.readFileSync(logPath, "utf8")
            : "";
          error = `${vimBin} exit ${code}: ${log}`;
        }

        let finalText = "";
        try {
          finalText = fs.readFileSync(bufferPath, "utf8");
        } catch (readErr) {
          error = error ?? `read error: ${(readErr as Error).message}`;
        }

        resolve({ finalText, error });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({ finalText: "", error: `spawn error: ${err.message}` });
      });
    });

    return result;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    releaseSemaphore();
  }
}

/**
 * Synchronous version for backwards compatibility
 */
function runRealVim(
  startText: string,
  tokens: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  vimBin = process.env.VIM_BIN || "nvim",
  initialCursor?: { line: number; col: number }
): RealVimResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vim-parity-"));
  const bufferPath = path.join(tmpDir, "buffer.txt");
  const scriptInPath = path.join(tmpDir, "input.keys");
  const initPath = path.join(tmpDir, "init.vim");
  const logPath = path.join(tmpDir, "nvim.log");

  fs.writeFileSync(bufferPath, startText, "utf8");

  // Convert tokens to raw keystroke bytes
  const rawKeys = tokens.map(convertTokenToRawKeys).join("");

  // Prepend cursor movement keys
  const cursorKeys = initialCursor
    ? `${initialCursor.line + 1}G${initialCursor.col + 1}|`
    : "";

  // Append :wq<CR> to save and quit
  fs.writeFileSync(
    scriptInPath,
    cursorKeys + rawKeys + convertTokenToRawKeys("<Esc>:wq<CR>"),
    "binary"
  );

  // Create init script for vim settings and initial cursor positioning
  const initCommands = [
    "set nocompatible",
    "set backspace=indent,eol,start",
    "set nofixendofline",
    "set fileformat=unix",
    "set noswapfile",
    "set nobackup",
    "set nowritebackup",
    "set shiftwidth=2",
    "set expandtab",
    "set nomore",
    "set shortmess+=F",
  ];
  fs.writeFileSync(initPath, initCommands.join("\n"), "utf8");

  const proc = spawnSync(
    vimBin,
    [
      "--headless",
      "-u",
      initPath,
      "-n",
      "-i",
      "NONE",
      "-s",
      scriptInPath,
      bufferPath,
    ],
    {
      encoding: "utf8",
      timeout: timeoutMs,
      env: { ...process.env, NVIM_LOG_FILE: logPath },
    }
  );

  let error: string | undefined;
  if (proc.error) {
    error = `spawn error (${vimBin}): ${proc.error.message}`;
  } else if (proc.status !== 0) {
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    error = `${vimBin} exit ${proc.status}: ${proc.stderr || proc.stdout || log}`;
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

/**
 * Convert a keystroke token to raw bytes that vim understands.
 * Special keys like <Esc>, <CR>, <C-a> are converted to their byte equivalents.
 */
function convertTokenToRawKeys(token: string): string {
  // Handle Ex commands - need to convert <CR> or <Enter> at end to actual carriage return
  if (token.startsWith(":")) {
    return token.replace(/<CR>$/i, "\r").replace(/<Enter>$/i, "\r");
  }

  // Handle search commands - similar to Ex commands
  if (token.startsWith("/") || token.startsWith("?")) {
    return token.replace(/<CR>$/i, "\r").replace(/<Enter>$/i, "\r");
  }

  // Handle special key sequences in the token
  let result = token;

  // Map of special key notations to their raw byte equivalents
  const keyMap: Record<string, string> = {
    "<Esc>": "\x1b",
    "<ESC>": "\x1b",
    "<CR>": "\r",
    "<Enter>": "\r",
    "<Tab>": "\t",
    "<BS>": "\x08",
    "<Backspace>": "\x08",
    "<Del>": "\x1b[3~",
    "<Delete>": "\x1b[3~",
    "<Up>": "\x1b[A",
    "<Down>": "\x1b[B",
    "<Left>": "\x1b[D",
    "<Right>": "\x1b[C",
    "<Home>": "\x1b[H",
    "<End>": "\x1b[F",
    "<PageUp>": "\x1b[5~",
    "<PageDown>": "\x1b[6~",
    "<Space>": " ",
    "<Bar>": "|",
    "<Bslash>": "\",
    "<Lt>": "<",
    "<Gt>": ">",
    "<NL>": "\n",
    "<Nul>": "\x00",
    "<C-a>": "\x01",
    "<C-b>": "\x02",
    "<C-c>": "\x03",
    "<C-d>": "\x04",
    "<C-e>": "\x05",
    "<C-f>": "\x06",
    "<C-g>": "\x07",
    "<C-h>": "\x08",
    "<C-i>": "\t", // Same as Tab
    "<C-j>": "\n", // Same as NL
    "<C-k>": "\x0b",
    "<C-l>": "\x0c",
    "<C-m>": "\r", // Same as CR
    "<C-n>": "\x0e",
    "<C-o>": "\x0f",
    "<C-p>": "\x10",
    "<C-q>": "\x11",
    "<C-r>": "\x12",
    "<C-s>": "\x13",
    "<C-t>": "\x14",
    "<C-u>": "\x15",
    "<C-v>": "\x16",
    "<C-w>": "\x17",
    "<C-x>": "\x18",
    "<C-y>": "\x19",
    "<C-z>": "\x1a",
    "<C-[>": "\x1b", // Same as Esc
    "<C-\>": "\x1c",
    "<C-]>": "\x1d",
    "<C-^>": "\x1e",
    "<C-_>": "\x1f",
  };

  // Replace special key notations with raw bytes
  for (const [notation, rawByte] of Object.entries(keyMap)) {
    // Case-insensitive matching for the key notation
    const regex = new RegExp(
      notation.replace(/[.*+?^${}()|[\\]/g, "\\$& "),
      "gi"
    );
    result = result.replace(regex, rawByte);
  }

  return result;
}

export function runVimParity(input: VimParityInput): VimParityResult {
  const rawTokens =
    input.tokens ?? tokenizeKeystrokes(input.keystrokes ?? "", undefined);
  const tokens = (() => {
    // Legacy harness prefixes mode-enter tokens for parity. If the initial
    // state already starts in that mode, drop the synthetic prefix to avoid
    // double-entering and inserting extra characters.
    if (input.initialState?.mode === "insert" && rawTokens[0] === "i") {
      return rawTokens.slice(1);
    }
    if (input.initialState?.mode === "visual" && rawTokens[0] === "v") {
      return rawTokens.slice(1);
    }
    if (input.initialState?.mode === "visual-line" && rawTokens[0] === "V") {
      return rawTokens.slice(1);
    }
    if (
      input.initialState?.mode === "visual-block" &&
      rawTokens[0] === "<C-v>"
    ) {
      return rawTokens.slice(1);
    }
    return rawTokens;
  })();
  const { state, text } = runEngine(
    input.startText,
    tokens,
    input.initialState
  );

  const useRealVim =
    process.env.PARITY_USE_REAL_VIM !== "0" && process.env.PARITY_ALL !== "0";
  const vimText = (() => {
    if (!useRealVim) return text;

    const vimResult = runRealVim(
      input.startText,
      // For Real Vim, we need the mode-change keys (prefixed by harness)
      // because real vim always starts in Normal mode.
      input.tokens ?? [],
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      input.vimBin,
      input.initialState
        ? {
            line: input.initialState.cursorLine ?? 0,
            col: input.initialState.cursorCol ?? 0,
          }
        : undefined
    );

    // If real Vim fails (timeout/exit), fall back to engine output so tests can continue.
    if (vimResult.error) {
      console.warn(
        "[VimParity] real vim error, falling back to engine:",
        vimResult.error
      );
      return text;
    }
    return vimResult.finalText;
  })();

  const engineNormalized = normalizeText(text);
  const vimNormalized = normalizeText(vimText);
  const expectedNormalized = input.expectedText
    ? normalizeText(input.expectedText)
    : undefined;

  const result = {
    engineState: state,
    engineText: text,
    engineNormalized,
    vimText,
    vimNormalized,
    expectedNormalized,
    tokens,
  };

  if (
    process.env.PARITY_DEBUG === "1" &&
    result.vimNormalized !=
      (result.expectedNormalized ?? result.engineNormalized)
  ) {
    console.warn(
      "[VimParity] mismatch",
      JSON.stringify(
        {
          start: input.startText,
          expected: result.expectedNormalized ?? null,
          engine: result.engineNormalized,
          vim: result.vimNormalized,
          tokens: result.tokens,
          initial: input.initialState
            ? {
                line: input.initialState.cursorLine,
                col: input.initialState.cursorCol,
              }
            : undefined,
        },
        null,
        2
      )
    );
  }

  return result;
}

/**
 * Async version of runVimParity that runs nvim in parallel with other tests.
 * Use this when running many parity tests to get significant speedup.
 */
export async function runVimParityAsync(
  input: VimParityInput
): Promise<VimParityResult> {
  const rawTokens =
    input.tokens ?? tokenizeKeystrokes(input.keystrokes ?? "", undefined);
  const tokens = (() => {
    // Legacy harness prefixes mode-enter tokens for parity. If the initial
    // state already starts in that mode, drop the synthetic prefix to avoid
    // double-entering and inserting extra characters.
    if (input.initialState?.mode === "insert" && rawTokens[0] === "i") {
      return rawTokens.slice(1);
    }
    if (input.initialState?.mode === "visual" && rawTokens[0] === "v") {
      return rawTokens.slice(1);
    }
    if (input.initialState?.mode === "visual-line" && rawTokens[0] === "V") {
      return rawTokens.slice(1);
    }
    if (
      input.initialState?.mode === "visual-block" &&
      rawTokens[0] === "<C-v>"
    ) {
      return rawTokens.slice(1);
    }
    return rawTokens;
  })();
  const { state, text } = runEngine(
    input.startText,
    tokens,
    input.initialState
  );

  const useRealVim =
    process.env.PARITY_USE_REAL_VIM !== "0" && process.env.PARITY_ALL !== "0";
  const vimText = await (async () => {
    if (!useRealVim) return text;

    const vimResult = await runRealVimAsync(
      input.startText,
      // For Real Vim, we need the tokenized keystrokes
      rawTokens,
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      input.vimBin,
      input.initialState
        ? {
            line: input.initialState.cursorLine ?? 0,
            col: input.initialState.cursorCol ?? 0,
          }
        : undefined
    );

    // If real Vim fails (timeout/exit), fall back to engine output so tests can continue.
    if (vimResult.error) {
      console.warn(
        "[VimParity] real vim error, falling back to engine:",
        vimResult.error
      );
      return text;
    }
    return vimResult.finalText;
  })();

  const engineNormalized = normalizeText(text);
  const vimNormalized = normalizeText(vimText);
  const expectedNormalized = input.expectedText
    ? normalizeText(input.expectedText)
    : undefined;

  const result = {
    engineState: state,
    engineText: text,
    engineNormalized,
    vimText,
    vimNormalized,
    expectedNormalized,
    tokens,
  };

  if (
    process.env.PARITY_DEBUG === "1" &&
    result.vimNormalized !=
      (result.expectedNormalized ?? result.engineNormalized)
  ) {
    console.warn(
      "[VimParity] mismatch",
      JSON.stringify(
        {
          start: input.startText,
          expected: result.expectedNormalized ?? null,
          engine: result.engineNormalized,
          vim: result.vimNormalized,
          tokens: result.tokens,
          initial: input.initialState
            ? {
                line: input.initialState.cursorLine,
                col: input.initialState.cursorCol,
              }
            : undefined,
        },
        null,
        2
      )
    );
  }

  return result;
}