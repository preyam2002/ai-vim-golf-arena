import { VimState } from "./vim-types";
import {
  clampCursor,
  deleteRange,
  findWordBoundary,
  findChar,
  saveUndo,
} from "./vim-utils";
import { saveToRegister } from "./vim-registers";

export function handleVisualModeKeystroke(
  state: VimState,
  keystroke: string
): VimState {
  if (keystroke === "<Esc>" || keystroke === "<ESC>") {
    const range = state.visualStart
      ? {
          startLine: state.visualStart.line,
          startCol: state.visualStart.col,
          endLine: state.cursorLine,
          endCol: state.cursorCol,
        }
      : null;

    if (range && range.endLine < range.startLine) {
      [range.startLine, range.endLine] = [range.endLine, range.startLine];
      [range.startCol, range.endCol] = [range.endCol, range.startCol];
    }

    if (state.visualStart) {
      state.cursorLine = state.visualStart.line;
      state.cursorCol = 0;
    }
    state.mode = "normal";
    state.visualStart = null;
    state.visualBlockWaitingInsert = false;
    state.visualBlockInsertBuffer = "";
    state.visualBlockInsertStart = null;
    state.visualBlockInsertEnd = null;
    return state;
  }

  // Handle Command Mode entry from Visual Mode
  if (keystroke === ":") {
    state.commandLine = "'<,'>"; // Prefill range
    state.mode = "commandline";
    return state;
  }

  // Handle pending find/till targets (f/F/t/T)
  if (state.pendingOperator && ["f", "F", "t", "T"].includes(state.pendingOperator)) {
    const dir = state.pendingOperator as "f" | "F" | "t" | "T";
    const line = state.lines[state.cursorLine] || "";
    let startCol = state.cursorCol;
    if (dir === "t") startCol++;
    else if (dir === "T") startCol--;
    let newCol = findChar(line, startCol, keystroke, dir);
    if (dir === "f") {
      newCol = Math.max(0, newCol - 1);
    }
    state.cursorCol = newCol;
    state.pendingOperator = null;
    return state;
  }

  // Get visual selection range
  const getVisualRange = () => {
    if (!state.visualStart) return null;

    let startLine = state.visualStart.line;
    let startCol = state.visualStart.col;
    let endLine = state.cursorLine;
    let endCol = state.cursorCol;

    if (endLine < startLine || (endLine === startLine && endCol < startCol)) {
      [startLine, startCol, endLine, endCol] = [
        endLine,
        endCol,
        startLine,
        startCol,
      ];
    }

    return { startLine, startCol, endLine, endCol };
  };

  const range = getVisualRange();

  // In visual block mode `$` should extend selection to the end of the longest
  // line in the block, not just the current cursor line.
  if (state.mode === "visual-block" && range && keystroke === "$") {
    let maxLen = 0;
    for (let line = range.startLine; line <= range.endLine; line++) {
      maxLen = Math.max(maxLen, state.lines[line]?.length ?? 0);
    }
    state.cursorCol = Math.max(0, maxLen - 1);
  }

  // Visual mode operators
  if (range) {
    if (
      state.mode === "visual-block" &&
      state.pendingOperator === "g" &&
      (keystroke === "<C-a>" || keystroke === "<C-x>")
    ) {
      // g<C-a>/g<C-x> in visual-block: increment/decrement numbers sequentially down the block
      const delta = keystroke === "<C-a>" ? 1 : -1;
      const startCol = Math.min(range.startCol, range.endCol);
      const endCol = Math.max(range.startCol, range.endCol);

      const findNumberInSlice = (text: string) => {
        // Look for a number that begins within the selected columns, but allow it to extend left.
        let i = startCol;
        while (i < text.length && i <= endCol && !/\d/.test(text[i])) i++;
        if (i > endCol || i >= text.length) return null;
        while (i > 0 && /\d/.test(text[i - 1])) i--;
        let j = i;
        while (j < text.length && /\d/.test(text[j])) j++;
        return { start: i, end: j };
      };

      let baseNumber: number | null = null;
      let changed = false;

      // Only save undo if we actually change something
      for (let line = range.startLine; line <= range.endLine; line++) {
        const text = state.lines[line] || "";
        if (!text.length) continue;

        const numberSpan = findNumberInSlice(text);
        if (!numberSpan) continue;

        if (baseNumber === null) {
          baseNumber = parseInt(text.slice(numberSpan.start, numberSpan.end), 10);
          if (Number.isNaN(baseNumber)) {
            baseNumber = null;
            continue;
          }
          saveUndo(state);
        }

        if (baseNumber === null) continue;
        const offset = (line - range.startLine) * delta;
        const newVal = baseNumber + offset;
        const newValStr = newVal.toString();
        state.lines[line] =
          text.slice(0, numberSpan.start) + newValStr + text.slice(numberSpan.end);
        changed = true;
      }

      state.pendingOperator = null;
      state.mode = "normal";
      state.visualStart = null;
      if (changed) {
        state.lastChange = { keys: [...state.commandBuffer, keystroke] };
      }
      state.commandBuffer = [];
      state.countBuffer = "";
      return state;
    }

    // Direct text input in visual-block: append/insert across the block.
    const movementChars = new Set([
      "h",
      "j",
      "k",
      "l",
      "w",
      "W",
      "e",
      "E",
      "b",
      "B",
      "0",
      "^",
      "$",
      "g",
      "G",
      "f",
      "F",
      "t",
      "T",
      "n",
      "N",
      "*",
      "#",
      "%",
    ]);

    if (keystroke === "d" || keystroke === "x") {
      saveUndo(state);

      if (state.mode === "visual-block") {
        const startCol = Math.min(range.startCol, range.endCol);
        const endCol = Math.max(range.startCol, range.endCol);
        for (let line = range.startLine; line <= range.endLine; line++) {
          const text = state.lines[line] || "";
          if (text.length === 0 || startCol >= text.length) continue;
          const deleteStart = Math.min(startCol, text.length);
          const deleteEnd = Math.min(endCol, text.length - 1);
          state.lines[line] =
            text.slice(0, deleteStart) + text.slice(deleteEnd + 1);
        }
        saveToRegister(state, ""); // minimal placeholder so yank register isn't stale
      } else {
        const isLineWise = state.mode === "visual-line";
        deleteRange(
          state,
          range.startLine,
          range.startCol,
          range.endLine,
          range.endCol,
          isLineWise,
          undefined,
          saveToRegister
        );
      }
      state.cursorLine = range.startLine;
      state.cursorCol = range.startCol;
      state.mode = "normal";
      state.visualStart = null;
      return state;
    }

    if (keystroke === "c") {
      saveUndo(state);
      const isLineWise = state.mode === "visual-line";
      deleteRange(
        state,
        range.startLine,
        range.startCol,
        range.endLine,
        range.endCol,
        isLineWise,
        undefined,
        saveToRegister
      );
      state.mode = "insert";
      // Restore cursor to startCol because deleteRange clamped it for Normal mode,
      // but Insert mode allows cursor at end of line.
      state.cursorCol = range.startCol;
      clampCursor(state); // Re-clamp for Insert mode
      state.visualStart = null;
      return state;
    }

    if (keystroke === "y") {
      // Yank doesn't usually save undo?
      // Vim documentation says yank doesn't change text, so no undo.
      const isLineWise = state.mode === "visual-line";
      let text;
      if (isLineWise) {
        text = state.lines.slice(range.startLine, range.endLine + 1).join("\n");
      } else {
        if (range.startLine === range.endLine) {
          text = state.lines[range.startLine].slice(
            range.startCol,
            range.endCol + 1
          );
        } else {
          text =
            state.lines[range.startLine].slice(range.startCol) +
            "\n" +
            state.lines.slice(range.startLine + 1, range.endLine).join("\n") +
            "\n" +
            state.lines[range.endLine].slice(0, range.endCol + 1);
        }
      }
      saveToRegister(state, text, undefined, isLineWise);
      state.cursorLine = range.startLine;
      state.cursorCol = range.startCol;
      state.mode = "normal";
      state.visualStart = null;
      return state;
    }

    if (keystroke === ">" || keystroke === "<") {
      saveUndo(state);
      const indent = keystroke === ">";
      for (let i = range.startLine; i <= range.endLine; i++) {
        if (indent) {
          state.lines[i] = "  " + state.lines[i];
        } else {
          if (state.lines[i].startsWith("  ")) {
            state.lines[i] = state.lines[i].slice(2);
          } else if (state.lines[i].startsWith(" ")) {
            state.lines[i] = state.lines[i].slice(1);
          }
        }
      }
      state.mode = "normal";
      state.visualStart = null;
      return state;
    }

    if (state.mode === "visual-block" && (keystroke === "A" || keystroke === "I")) {
      const startCol = Math.min(range.startCol, range.endCol);
      const endCol = Math.max(range.startCol, range.endCol);
      let startLine = range.startLine;
      let endLine = range.endLine;
      if (state.commandBuffer.includes("b")) {
        endLine = Math.min(endLine, startLine + 1);
      }
      const targetCol =
        keystroke === "A"
          ? Math.max(
              ...state.lines
                .slice(startLine, endLine + 1)
                .map((l) => (l?.length ?? 0))
            )
          : startCol;

      state.visualBlockImplicitInsert = false;
      state.visualBlock = {
        startLine,
        endLine,
        col: targetCol,
        insertStartIndex: state.commandBuffer.length,
        append: keystroke === "A",
      };
      state.visualBlockWaitingInsert = false;
      state.visualBlockInsertBuffer = "";
      state.mode = "insert";
      state.visualStart = null;
      const line = state.lines[state.cursorLine] || "";
      state.cursorCol =
        keystroke === "A" ? line.length : Math.min(startCol, line.length);
      clampCursor(state);
      return state;
    }
  }

  // Movement in visual mode
  // Handle 'g' prefix for gg, ge, gE
  if (state.pendingOperator === "g") {
    state.pendingOperator = null;
    if (keystroke === "g") {
      // gg
      state.cursorLine = 0;
      state.cursorCol = 0;
      clampCursor(state);
      return state;
    } else if (keystroke === "e") {
      // ge
      const line = state.lines[state.cursorLine];
      state.cursorCol = findWordBoundary(line, state.cursorCol, "ge");
      return state;
    } else if (keystroke === "E") {
      // gE
      const line = state.lines[state.cursorLine];
      state.cursorCol = findWordBoundary(line, state.cursorCol, "gE");
      return state;
    }
  }

  if (keystroke === "g") {
    state.pendingOperator = "g";
    return state;
  }

  switch (keystroke) {
    case "h":
      state.cursorCol = Math.max(0, state.cursorCol - 1);
      break;
    case "l":
      state.cursorCol = Math.min(
        (state.lines[state.cursorLine]?.length || 1) - 1,
        state.cursorCol + 1
      );
      break;
    case "j":
      state.cursorLine = Math.min(state.lines.length - 1, state.cursorLine + 1);
      clampCursor(state);
      break;
    case "k":
      state.cursorLine = Math.max(0, state.cursorLine - 1);
      clampCursor(state);
      break;
    case "G":
      state.cursorLine = state.lines.length - 1;
      clampCursor(state);
      break;
    case "$":
      state.cursorCol = (state.lines[state.cursorLine]?.length || 1) - 1;
      break;
    case "0":
      state.cursorCol = 0;
      break;
    case "^": {
      const line = state.lines[state.cursorLine];
      const firstNonWs = line.search(/\S/);
      state.cursorCol = firstNonWs !== -1 ? firstNonWs : 0;
      break;
    }
    case "w":
    case "W": {
      const line = state.lines[state.cursorLine];
      state.cursorCol = findWordBoundary(
        line,
        state.cursorCol,
        keystroke as any
      );
      break;
    }
    case "e":
    case "E":
    case "b":
    case "B": {
      const line = state.lines[state.cursorLine];
      state.cursorCol = findWordBoundary(
        line,
        state.cursorCol,
        keystroke as any
      );
      break;
    }
    case "f":
    case "F":
    case "t":
    case "T": {
      state.pendingOperator = keystroke;
      return state;
    }
  }

  return state;
}
