// Enhanced Vim Engine with comprehensive command support
// Supports: motions, operators, text objects, visual mode, undo/redo, registers, search, marks

import {
  VimState,
  HistoryEntry,
  LastChange,
  SearchState,
  SearchMatch,
  Mark,
  FindChar,
  VimOptions,
} from "./vim-types";
import {
  isWordChar,
  toggleCase,
  incrementNumber,
  isWhitespace,
  findMatchingBracket,
  findWordBoundary,
  findChar,
} from "./vim-utils";
import { handleNormalModeKeystroke } from "./vim-mode-normal";
import { handleInsertModeKeystroke } from "./vim-mode-insert";
import { handleVisualModeKeystroke } from "./vim-mode-visual";
import { handleCommandModeKeystroke } from "./vim-mode-command";
import { executeExCommand } from "./vim-ex-commands";
import { performSearch } from "./vim-search";

export type {
  VimState,
  HistoryEntry,
  LastChange,
  SearchState,
  SearchMatch,
  Mark,
  FindChar,
};

const DEFAULT_VIM_OPTIONS: VimOptions = {
  compatible: false,
  scrolloff: 3,
  autoindent: true,
  showcmd: true,
  backup: false,
  number: true,
  ruler: true,
  hlsearch: true,
  incsearch: true,
  showmatch: true,
  ignorecase: true,
  smartcase: true,
  visualbell: false,
  backspace: { indent: true, eol: true, start: true },
  runtimepath: "$VIMRUNTIME",
  syntax: true,
  filetype: { detection: true, indent: true },
  terminalReverse: "",
};
export { DEFAULT_VIM_OPTIONS };

function mergeOptions(options?: Partial<VimOptions>): VimOptions {
  if (!options) {
    return {
      ...DEFAULT_VIM_OPTIONS,
      backspace: { ...DEFAULT_VIM_OPTIONS.backspace },
      filetype: { ...DEFAULT_VIM_OPTIONS.filetype },
    };
  }

  return {
    ...DEFAULT_VIM_OPTIONS,
    ...options,
    backspace: {
      ...DEFAULT_VIM_OPTIONS.backspace,
      ...(options.backspace || {}),
    },
    filetype: {
      ...DEFAULT_VIM_OPTIONS.filetype,
      ...(options.filetype || {}),
    },
  };
}

export function createInitialState(
  text: string,
  options?: Partial<VimOptions>
): VimState {
  const lines = text.split("\n");
  const mergedOptions = mergeOptions(options);
  return {
    lines: lines.length > 0 ? lines : [""],
    cursorLine: 0,
    cursorCol: 0,
    mode: "normal",
    pendingOperator: null,
    registers: { '"': "" }, // default register
    registerMetadata: { '"': { isLinewise: false } },
    undoStack: [],
    redoStack: [],
    lastChange: null,
    searchState: {
      pattern: "",
      direction: "forward",
      lastMatches: [],
      currentMatchIndex: -1,
      allowWrap: true,
    },
    marks: {},
    visualStart: null,
    countBuffer: "",
    lastFindChar: null,
    activeRegister: null,
    recordingMacro: null,
    macroBuffer: "",
    lastMacroRegister: null,
    commandBuffer: [],
    pendingDigraph: null,
    lineAtCursorEntry: null,
    visualBlock: null,
    visualBlockRagged: false,
    visualBlockWaitingInsert: false,
    visualBlockImplicitInsert: false,
    visualBlockInsertBuffer: "",
    visualBlockInsertStart: null,
    visualBlockInsertEnd: null,
    insertRepeatCount: 1,
    insertRepeatKeys: [],
    commandLine: null,
    pendingMotion: null,
    lastVisualSelection: null,
    options: mergedOptions,
  };
}

export function extractKeystroke(input: string, mode: string): string | null {
  if (input.length === 0) return null;

  if (input[0] === "<") {
    const endIdx = input.indexOf(">");
    if (endIdx === -1) return null;

    const content = input.slice(1, endIdx);
    // Heuristic: If content contains <, =, or | (and not "Bar"), it's likely not a special key
    if (
      content.includes("<") ||
      content.includes("=") ||
      (content.includes("|") && content !== "Bar")
    ) {
      return "<";
    }

    return input.slice(0, endIdx + 1);
  }

  return input[0];
}

export function executeKeystrokeInternal(
  state: VimState,
  keystroke: string
): VimState {
  let newState = JSON.parse(JSON.stringify(state));
  newState.commandBuffer.push(keystroke);

  // Record macros if active
  if (newState.recordingMacro) {
    if (keystroke === "q") {
      // Stop recording and save macro
      newState.registers[newState.recordingMacro] = newState.macroBuffer;
      newState.registerMetadata[newState.recordingMacro] = {
        isLinewise: false,
      };
      newState.macroBuffer = "";
      newState.recordingMacro = null;
      return newState;
    } else {
      newState.macroBuffer += keystroke;
    }
  }

  // Handle Ex Commands (e.g. :%s/...<CR>)
  if (keystroke.startsWith(":") && keystroke.endsWith("<CR>")) {
    return executeExCommand(newState, keystroke, {
      executeKeystroke,
      tokenizeKeystrokes,
    });
  }

  // Handle Search Commands (e.g. /pattern<CR>) passed as a single token
  if (
    (keystroke.startsWith("/") || keystroke.startsWith("?")) &&
    keystroke.endsWith("<CR>")
  ) {
    const pattern = keystroke.slice(1, -4); // Remove / and <CR>
    const direction = keystroke.startsWith("/") ? "forward" : "backward";

    newState.searchState.pattern = pattern;
    newState.searchState.direction = direction;
    newState.searchState.allowWrap = true;

    // Include a match at the cursor position when initiating a search, so
    // `/hello` while on "hello" lands on the current word instead of skipping
    // to the next occurrence.
    const searchStartCol =
      direction === "forward"
        ? Math.max(-1, newState.cursorCol - 1)
        : newState.cursorCol + 1;

    let matches = performSearch(
      newState.lines,
      pattern,
      newState.cursorLine,
      searchStartCol,
      direction,
      newState.options
    );

    if (matches.length === 0) {
      const wrapLine = direction === "forward" ? -1 : newState.lines.length;
      const wrapCol = direction === "forward" ? -1 : Number.MAX_SAFE_INTEGER;
      matches = performSearch(
        newState.lines,
        pattern,
        wrapLine,
        wrapCol,
        direction,
        newState.options
      );
    }

    if (matches.length > 0) {
      newState.cursorLine = matches[0].line;
      newState.cursorCol = matches[0].col;
      newState.searchState.lastMatches = matches;
      newState.searchState.currentMatchIndex = 0;
    } else {
      newState.searchState.lastMatches = [];
      newState.searchState.currentMatchIndex = -1;
    }

    return newState;
  }

  // In insert/replace modes, treat multi-char tokens (that aren't special keys)
  // as individual typed characters to avoid misinterpreting bundled motion tokens.
  if (
    (newState.mode === "insert" || newState.mode === "replace") &&
    keystroke.length > 1 &&
    !keystroke.startsWith("<")
  ) {
    let tempState = newState;
    for (const ch of keystroke.split("")) {
      tempState = executeKeystroke(tempState, ch);
    }
    return tempState;
  }

  switch (newState.mode) {
    case "normal":
      return handleNormalModeKeystroke(newState, keystroke);
    case "insert":
    case "replace":
      return handleInsertModeKeystroke(newState, keystroke);
    case "visual":
    case "visual-line":
    case "visual-block":
      return handleVisualModeKeystroke(newState, keystroke);
    case "commandline":
      return handleCommandModeKeystroke(newState, keystroke);
    default:
      console.warn(`Unknown mode: ${newState.mode}`);
      return newState;
  }
}

export function executeKeystroke(state: VimState, keystroke: string): VimState {
  return executeKeystrokeInternal(state, keystroke);
}

export function tokenizeKeystrokes(
  keystrokes: string,
  maxTokens = Number.POSITIVE_INFINITY
): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < keystrokes.length) {
    if (tokens.length >= maxTokens) break;

    // Combine find/till motions with their target character (f,F,t,T),
    // but avoid swallowing special-key sequences like <Esc>.
    if (
      "fFtT".includes(keystrokes[i]) &&
      i + 1 < keystrokes.length &&
      keystrokes[i + 1] !== "<"
    ) {
      tokens.push(keystrokes.slice(i, i + 2));
      i += 2;
      continue;
    }

    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i);
      if (end !== -1) {
        tokens.push(keystrokes.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    tokens.push(keystrokes[i]);
    i++;
  }

  return tokens;
}

export function formatToken(token: string): string {
  if (token === " ") return "␣";
  if (token === "\n") return "↵";
  if (token === "\t") return "⇥";
  return token;
}

export function normalizeText(text: string): string {
  // Preserve trailing spaces but normalize newlines and drop a single trailing \n
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

export function countKeystrokes(keystrokes: string): number {
  let count = 0;
  let i = 0;
  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i);
      if (end !== -1) {
        count++;
        i = end + 1;
        continue;
      }
    }
    count++;
    i++;
  }
  return count;
}
