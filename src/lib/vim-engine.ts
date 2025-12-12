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
import { executeExCommand, ExCommandHelpers } from "./vim-ex-commands";
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
  maxHistorySize: 1000,
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
  // Split into lines, but handle trailing newline like vim does:
  // "line1\nline2\n" should be 2 lines, not 3 (trailing newline is terminator, not new line)
  let lines = text.split("\n");
  if (
    lines.length > 1 &&
    lines[lines.length - 1] === "" &&
    text.endsWith("\n")
  ) {
    lines = lines.slice(0, -1);
  }
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
    globalHistory: [
      {
        lines: lines.length > 0 ? lines : [""],
        cursorLine: 0,
        cursorCol: 0,
        timestamp: Date.now(),
      },
    ],
    globalHistoryIndex: 0,
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
  keystroke: string,
  helpers?: ExCommandHelpers
): VimState {
  // Manual clone to avoid deep cloning extensive history arrays (OOM fix)
  let newState: VimState = {
    ...state,
    lines: [...state.lines],
    registers: { ...state.registers },
    registerMetadata: { ...state.registerMetadata },
    undoStack: [...state.undoStack],
    redoStack: [...state.redoStack],
    undoRoot: state.undoRoot, // Tree structure is shared/persistent
    undoHead: state.undoHead,
    undoList: state.undoList ? [...state.undoList] : undefined,
    lastChange: state.lastChange
      ? { ...state.lastChange, keys: [...state.lastChange.keys] }
      : null,
    searchState: {
      ...state.searchState,
      lastMatches: [...state.searchState.lastMatches],
    },
    marks: { ...state.marks },
    visualStart: state.visualStart ? { ...state.visualStart } : null,
    lastFindChar: state.lastFindChar ? { ...state.lastFindChar } : null,
    commandBuffer: [...state.commandBuffer],
    lineAtCursorEntry: state.lineAtCursorEntry
      ? { ...state.lineAtCursorEntry }
      : null,
    visualBlock: state.visualBlock ? { ...state.visualBlock } : null,
    insertRepeatKeys: [...state.insertRepeatKeys],
    globalHistory: [...state.globalHistory],
    lastVisualSelection: state.lastVisualSelection
      ? { ...state.lastVisualSelection }
      : null,
    options: {
      ...state.options,
      backspace: { ...state.options.backspace },
      filetype: { ...state.options.filetype },
    },
  };
  const MAX_TEXT_CHARS = 2_000_000;
  const ensureReasonableSize = () => {
    // Guard against runaway substitutions/globals that explode buffer size.
    let total = 0;
    for (const line of newState.lines) {
      total += line.length + 1; // include newline
      if (total > MAX_TEXT_CHARS) break;
    }
    if (total > MAX_TEXT_CHARS) {
      throw new Error(
        `[VimEngine] Aborting: text exceeded ${MAX_TEXT_CHARS} characters`
      );
    }
  };
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

  // Handle Ex Commands (e.g. :%s/...<CR>) - but only when NOT in insert/replace mode
  // In insert mode, a colon is just a character to be inserted
  if (
    keystroke.startsWith(":") &&
    keystroke.endsWith("<CR>") &&
    newState.mode !== "insert" &&
    newState.mode !== "replace"
  ) {
    const nextState = executeExCommand(newState, keystroke, {
      executeKeystroke,
      tokenizeKeystrokes,
      ...(helpers || {}),
    });
    ensureReasonableSize();
    return nextState;
  }

  // Handle Search Commands (e.g. /pattern<CR>) passed as a single token
  if (
    (keystroke.startsWith("/") || keystroke.startsWith("?")) &&
    keystroke.endsWith("<CR>")
  ) {
    if (newState.commandLine !== null) {
      newState.commandLine = null;
      newState.mode = "normal";
    }

    const pattern = keystroke.slice(1, -4); // Remove / and <CR>
    const direction = keystroke.startsWith("/") ? "forward" : "backward";

    newState.searchState.pattern = pattern;
    newState.searchState.direction = direction;
    newState.searchState.allowWrap = true;

    // In vim, forward search `/pattern` finds the next match AFTER cursor
    // position, skipping any match at the current cursor.
    const searchStartCol =
      direction === "forward" ? newState.cursorCol : newState.cursorCol + 1;

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
  // But we need to preserve special key sequences like <Esc>, <CR>, etc.
  if (
    (newState.mode === "insert" || newState.mode === "replace") &&
    keystroke.length > 1 &&
    !keystroke.startsWith("<")
  ) {
    let tempState = newState;
    let i = 0;
    while (i < keystroke.length) {
      if (keystroke[i] === "<") {
        // Preserve special key sequences like <Esc>, <CR>, etc.
        const end = keystroke.indexOf(">", i);
        if (end !== -1) {
          tempState = executeKeystroke(
            tempState,
            keystroke.slice(i, end + 1),
            helpers
          );
          i = end + 1;
          continue;
        }
      }
      tempState = executeKeystroke(tempState, keystroke[i], helpers);
      i++;
    }
    return tempState;
  }

  switch (newState.mode) {
    case "normal":
      newState = handleNormalModeKeystroke(newState, keystroke);
      ensureReasonableSize();
      return newState;
    case "insert":
    case "replace":
      newState = handleInsertModeKeystroke(newState, keystroke);
      ensureReasonableSize();
      return newState;
    case "visual":
    case "visual-line":
    case "visual-block":
      newState = handleVisualModeKeystroke(newState, keystroke);
      ensureReasonableSize();
      return newState;
    case "commandline":
      newState = handleCommandModeKeystroke(newState, keystroke);
      ensureReasonableSize();
      return newState;
    default:
      console.warn(`Unknown mode: ${newState.mode}`);
      ensureReasonableSize();
      return newState;
  }
}

export function executeKeystroke(
  state: VimState,
  keystroke: string,
  helpers?: ExCommandHelpers
): VimState {
  return executeKeystrokeInternal(state, keystroke, helpers);
}

export function tokenizeKeystrokes(
  keystrokes: string,
  maxTokens = Number.POSITIVE_INFINITY
): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < keystrokes.length) {
    if (tokens.length >= maxTokens) break;

    // Bundle full Ex or search commands that end with <CR>/<Enter>
    if (
      keystrokes[i] === ":" ||
      keystrokes[i] === "/" ||
      keystrokes[i] === "?"
    ) {
      const slice = keystrokes.slice(i);
      const crIdx = slice.indexOf("<CR>");
      const enterIdx = slice.indexOf("<Enter>");
      const endIdx =
        crIdx !== -1 ? crIdx + 4 : enterIdx !== -1 ? enterIdx + 7 : -1;
      if (endIdx !== -1) {
        tokens.push(keystrokes.slice(i, i + endIdx));
        i += endIdx;
        continue;
      }
    }

    if (keystrokes[i] === "$") {
      tokens.push("$");
      i += 1;
      continue;
    }

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
  // Normalize newlines, trim trailing whitespace per line, then drop trailing empty lines
  const normalizedNewlines = text.replace(/\r\n/g, "\n");
  const lines = normalizedNewlines
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""));
  // Drop trailing empty lines for more robust parity comparison
  while (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.join("\n");
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
