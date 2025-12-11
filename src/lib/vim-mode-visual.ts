import { VimState } from "./vim-types";
import {
  clampCursor,
  deleteRange,
  findWordBoundary,
  findChar,
  findSentenceStartBackward,
  findSentenceStartForward,
  saveUndo,
} from "./vim-utils";
import {
  saveDeleteRegister,
  saveToRegister,
  getRegister,
  getRegisterMetadata,
} from "./vim-registers";

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
      state.cursorCol = state.visualStart.col;
    }
    state.mode = "normal";
    state.visualStart = null;
    state.visualBlockWaitingInsert = false;
    state.visualBlockInsertBuffer = "";
    state.visualBlockInsertStart = null;
    state.visualBlockInsertEnd = null;
    state.visualBlockRagged = false;
    return state;
  }

  // Handle Command Mode entry from Visual Mode
  if (keystroke === ":") {
    state.commandLine = "'<,'>"; // Prefill range
    state.mode = "commandline";
    return state;
  }

  // Handle Visual filter command (!) by pre-filling range and switching to
  // command-line mode so the ex-layer can execute the filter.
  // When typing text in visual block mode we want "!" to behave like normal
  // input rather than entering the filter command. Skip the filter path in that
  // case so characters get appended across the selection.
  if (keystroke === "!" && state.mode !== "visual-block") {
    state.commandLine = "'<,'>!";
    state.mode = "commandline";
    state.pendingOperator = null;
    return state;
  }

  // Count prefixes in visual modes (e.g., V9j).
  if (/^[1-9]$/.test(keystroke) || (keystroke === "0" && state.countBuffer)) {
    state.countBuffer += keystroke;
    return state;
  }

  // Handle pending find/till targets (f/F/t/T)
  if (
    state.pendingOperator &&
    ["f", "F", "t", "T"].includes(state.pendingOperator)
  ) {
    const dir = state.pendingOperator as "f" | "F" | "t" | "T";
    const line = state.lines[state.cursorLine] || "";
    state.cursorCol = findChar(line, state.cursorCol, keystroke, dir);
    state.pendingOperator = null;
    return state;
  }

  // Support bundled find/till tokens (e.g., "fn") in visual modes by splitting.
  if (keystroke.length > 1 && "fFtT".includes(keystroke[0])) {
    state.pendingOperator = keystroke[0];
    return handleVisualModeKeystroke(state, keystroke.slice(1));
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

  let range = getVisualRange();

  if (range) {
    state.lastVisualSelection = {
      mode: state.mode as "visual" | "visual-line" | "visual-block",
      startLine: range.startLine,
      startCol: range.startCol,
      endLine: range.endLine,
      endCol: range.endCol,
      ragged: state.visualBlockRagged,
    };
  }

  // In visual block mode `$` should extend selection to the end of the longest
  // line in the block, not just the current cursor line.
  if (state.mode === "visual-block" && range && keystroke === "$") {
    let maxLen = 0;
    for (let line = range.startLine; line <= range.endLine; line++) {
      maxLen = Math.max(maxLen, state.lines[line]?.length ?? 0);
    }
    state.cursorCol = Math.max(0, maxLen - 1);
    state.visualBlockRagged = true;
    range = getVisualRange();
    return state;
  }

  // Visual mode operators
  if (range) {
    if (
      state.mode === "visual-block" &&
      state.pendingOperator === "g" &&
      (keystroke === "<C-a>" || keystroke === "<C-x>")
    ) {
      // g<C-a>/g<C-x> in visual-block: increment/decrement numbers sequentially down the block
      const count = Math.max(1, parseInt(state.countBuffer || "1", 10));
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

      let seq = 1;
      let changed = false;

      // Only save undo if we actually change something
      for (let line = range.startLine; line <= range.endLine; line++) {
        const text = state.lines[line] || "";
        if (!text.length) continue;

        const numberSpan = findNumberInSlice(text);
        if (!numberSpan) continue;

        const currentVal = parseInt(
          text.slice(numberSpan.start, numberSpan.end),
          10
        );
        
        if (Number.isNaN(currentVal)) continue;

        if (!changed) saveUndo(state);

        const change = seq * count * delta;
        const newVal = currentVal + change;
        const newValStr = newVal.toString();
        state.lines[line] =
          text.slice(0, numberSpan.start) +
          newValStr +
          text.slice(numberSpan.end);
        changed = true;
        seq++;
      }

      state.pendingOperator = null;
      state.mode = "normal";
      state.visualStart = null;
      if (changed) {
        state.lastChange = {
          keys: [...state.commandBuffer, keystroke],
          isChange: true,
        };
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
        const ragged = state.visualBlockRagged;
        const deletedPieces: string[] = [];
        let endLine = range.endLine;
        if (ragged) {
          endLine = Math.min(state.lines.length - 1, range.endLine + 1);
        }
        for (let line = range.startLine; line <= endLine; line++) {
          const text = state.lines[line] || "";
          const deleteStart = Math.min(startCol, text.length);
          const deleteEnd = ragged
            ? Math.max(0, Math.min(endCol, text.length - 1))
            : Math.min(endCol, Math.max(0, text.length - 1));
          const deletedSlice =
            deleteStart >= text.length
              ? ""
              : text.slice(deleteStart, deleteEnd + 1);
          deletedPieces.push(deletedSlice);
          if (text.length === 0 || startCol >= text.length) continue;
          state.lines[line] =
            text.slice(0, deleteStart) + text.slice(deleteEnd + 1);
        }
        saveDeleteRegister(state, deletedPieces.join("\n"), undefined, false);
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
          saveDeleteRegister
        );
      }
      state.cursorLine = range.startLine;
      state.cursorCol = range.startCol;
      state.visualBlockRagged = false;
      state.mode = "normal";
      state.visualStart = null;
      return state;
    }

    if (keystroke === "p" || keystroke === "P") {
      const reg = state.activeRegister || '"';
      const regText = getRegister(state, reg);
      const meta = getRegisterMetadata(state, reg);
      const selectionLines = state.lines.slice(
        range.startLine,
        range.endLine + 1
      );
      const selectionText = selectionLines.join("\n");

      let replacement = regText;
      if (!replacement) {
        // When pasting without an existing register payload, fall back to the
        // current selection (reversed for linewise to better mirror "swap").
        replacement =
          state.mode === "visual-line"
            ? selectionLines.slice().reverse().join("\n") + "\n"
            : selectionText;
      }

      const isLineWise = meta.isLinewise || state.mode === "visual-line";
      const insertLines = isLineWise
        ? replacement.replace(/\n$/, "").split("\n")
        : replacement.split("\n");

      saveUndo(state);
      deleteRange(
        state,
        range.startLine,
        range.startCol,
        range.endLine,
        range.endCol,
        isLineWise,
        undefined,
        saveDeleteRegister
      );

      if (isLineWise && state.lines.length === 1 && state.lines[0] === "") {
        state.lines = [];
      }

      let insertAt =
        keystroke === "p"
          ? Math.min(
              state.lines.length,
              isLineWise ? range.startLine : range.startLine + 1
            )
          : Math.max(0, range.startLine);
      state.lines.splice(insertAt, 0, ...insertLines);
      state.cursorLine = insertAt;
      state.cursorCol = isLineWise
        ? 0
        : Math.min(range.startCol, (insertLines[0]?.length ?? 1) - 1);
      state.mode = "normal";
      state.visualStart = null;
      state.visualBlockRagged = false;
      state.activeRegister = null;
      return state;
    }

    if (keystroke === "c") {
      saveUndo(state);
      const isLineWise = state.mode === "visual-line";
      if (state.mode === "visual-block") {
        const startCol = Math.min(range.startCol, range.endCol);
        const endCol = Math.max(range.startCol, range.endCol);
        const ragged = state.visualBlockRagged;
        const deletedPieces: string[] = [];
        let endLine = range.endLine;
        if (ragged) {
          endLine = Math.min(state.lines.length - 1, range.endLine + 1);
        }
        for (let line = range.startLine; line <= endLine; line++) {
          const text = state.lines[line] || "";
          const deleteStart = Math.min(startCol, text.length);
          const deleteEnd = ragged
            ? Math.max(0, text.length - 1)
            : Math.min(endCol, Math.max(0, text.length - 1));
          const deletedSlice =
            deleteStart >= text.length
              ? ""
              : text.slice(deleteStart, deleteEnd + 1);
          deletedPieces.push(deletedSlice);
          if (text.length === 0 || startCol >= text.length) continue;
          state.lines[line] =
            text.slice(0, deleteStart) + text.slice(deleteEnd + 1);
        }
        saveDeleteRegister(state, deletedPieces.join("\n"), undefined, false);
      } else {
        deleteRange(
          state,
          range.startLine,
          range.startCol,
          range.endLine,
          range.endCol,
          isLineWise,
          undefined,
          saveDeleteRegister
        );
      }
      state.mode = "insert";
      // Restore cursor to startCol because deleteRange clamped it for Normal mode,
      // but Insert mode allows cursor at end of line.
      state.cursorCol = range.startCol;
      clampCursor(state); // Re-clamp for Insert mode
      state.visualStart = null;
      state.visualBlockRagged = false;
      return state;
    }

    if (keystroke === "y") {
      // Yank doesn't usually save undo?
      // Vim documentation says yank doesn't change text, so no undo.
      const isLineWise = state.mode === "visual-line";
      let text;
      if (state.mode === "visual-block") {
        const startCol = Math.min(range.startCol, range.endCol);
        const endCol = Math.max(range.startCol, range.endCol);
        const ragged = state.visualBlockRagged;
        const pieces: string[] = [];
        for (let line = range.startLine; line <= range.endLine; line++) {
          const lineText = state.lines[line] || "";
          const sliceStart = Math.min(startCol, lineText.length);
          const sliceEnd = ragged
            ? lineText.length
            : Math.min(endCol + 1, lineText.length);
          pieces.push(
            sliceStart >= lineText.length
              ? ""
              : lineText.slice(sliceStart, sliceEnd)
          );
        }
        text = pieces.join("\n");
      } else if (isLineWise) {
        text = state.lines.slice(range.startLine, range.endLine + 1).join("\n");
      } else {
        if (range.startLine === range.endLine) {
          text = state.lines[range.startLine].slice(
            range.startCol,
            range.endCol + 1
          );
        } else {
          const middleLines = state.lines.slice(
            range.startLine + 1,
            range.endLine
          );
          const middleText =
            middleLines.length > 0 ? middleLines.join("\n") + "\n" : "";

          text =
            state.lines[range.startLine].slice(range.startCol) +
            "\n" +
            middleText +
            state.lines[range.endLine].slice(0, range.endCol + 1);
        }
      }
      saveToRegister(state, text, undefined, isLineWise);
      state.cursorLine = range.startLine;
      state.cursorCol = range.startCol;
      state.visualBlockRagged = false;
      state.mode = "normal";
      state.visualStart = null;
      return state;
    }

    if (keystroke === "U" || keystroke === "u" || keystroke === "~") {
      saveUndo(state);
      const applyCase = (segment: string) => {
        if (keystroke === "U") return segment.toUpperCase();
        if (keystroke === "u") return segment.toLowerCase();
        return segment
          .split("")
          .map((ch) =>
            ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
          )
          .join("");
      };

      if (state.mode === "visual-block") {
        const startCol = Math.min(range.startCol, range.endCol);
        const endCol = Math.max(range.startCol, range.endCol);
        const ragged = state.visualBlockRagged;
        let endLine = range.endLine;
        if (ragged) {
          endLine = Math.min(state.lines.length - 1, range.endLine + 1);
        }
        for (let line = range.startLine; line <= endLine; line++) {
          const text = state.lines[line] || "";
          const sliceStart = Math.min(startCol, text.length);
          const sliceEnd = ragged
            ? Math.max(0, text.length - 1)
            : Math.min(endCol, Math.max(0, text.length - 1));
          if (sliceStart > sliceEnd) continue;
          state.lines[line] =
            text.slice(0, sliceStart) +
            applyCase(text.slice(sliceStart, sliceEnd + 1)) +
            text.slice(sliceEnd + 1);
        }
      } else if (state.mode === "visual-line") {
        for (let line = range.startLine; line <= range.endLine; line++) {
          state.lines[line] = applyCase(state.lines[line] || "");
        }
      } else {
        if (range.startLine === range.endLine) {
          const text = state.lines[range.startLine] || "";
          state.lines[range.startLine] =
            text.slice(0, range.startCol) +
            applyCase(text.slice(range.startCol, range.endCol + 1)) +
            text.slice(range.endCol + 1);
        } else {
          state.lines[range.startLine] =
            state.lines[range.startLine].slice(0, range.startCol) +
            applyCase(state.lines[range.startLine].slice(range.startCol));
          for (let line = range.startLine + 1; line < range.endLine; line++) {
            state.lines[line] = applyCase(state.lines[line] || "");
          }
          const endText = state.lines[range.endLine] || "";
          state.lines[range.endLine] =
            applyCase(endText.slice(0, range.endCol + 1)) +
            endText.slice(range.endCol + 1);
        }
      }

      state.cursorLine = range.startLine;
      state.cursorCol = range.startCol;
      state.visualBlockRagged = false;
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

    if (
      state.mode === "visual-block" &&
      (keystroke === "A" || keystroke === "I")
    ) {
      const startCol = Math.min(range.startCol, range.endCol);
      const endCol = Math.max(range.startCol, range.endCol);
      let startLine = range.startLine;
      let endLine = range.endLine;
      const hadB = state.commandBuffer.includes("b");
      if (hadB) {
        endLine = Math.min(endLine, startLine + 1);
        // Anchor the insert on the top of the adjusted block so the typed text
        // does not land on an out-of-range line.
        state.cursorLine = startLine;
        state.cursorCol = startCol;
      }
      state.visualBlockImplicitInsert = false;
      state.visualBlock = {
        startLine,
        endLine,
        // Anchor at the selection start; per-line target (start or end) is
        // computed when replaying insert keys so ragged blocks append at each
        // line's own end.
        col: Math.min(range.startCol, range.endCol),
        insertStartIndex: 1,
        append: keystroke === "A",
        usedB: hadB,
      };
      state.commandBuffer = [keystroke];
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
  const blockMovementKeys = new Set([
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
    "G",
    "g",
    "n",
    "N",
    "*",
    "#",
    "%",
    "f",
    "F",
    "t",
    "T",
  ]);
  if (
    state.mode === "visual-block" &&
    keystroke !== "$" &&
    blockMovementKeys.has(keystroke)
  ) {
    // Clear ragged $ extension when moving the block selection.
    state.visualBlockRagged = false;
  }
  // Handle 'g' prefix for gg, ge, gE
  if (state.pendingOperator === "g") {
    state.pendingOperator = null;
    if (keystroke === "g") {
      // gg
      state.cursorLine = 0;
      state.cursorCol = 0;
      clampCursor(state);
      return state;
    } else if (keystroke === "0") {
      state.cursorCol = 0;
      clampCursor(state);
      return state;
    } else if (keystroke === "$") {
      state.cursorCol = (state.lines[state.cursorLine]?.length || 1) - 1;
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

  const count = Math.max(
    1,
    state.countBuffer ? parseInt(state.countBuffer, 10) : 1
  );
  state.countBuffer = "";

  switch (keystroke) {
    case "h":
      state.cursorCol = Math.max(0, state.cursorCol - count);
      break;
    case "l":
      state.cursorCol = Math.min(
        (state.lines[state.cursorLine]?.length || 1) - 1,
        state.cursorCol + count
      );
      break;
    case "j":
      state.cursorLine = Math.min(
        state.lines.length - 1,
        state.cursorLine + count
      );
      clampCursor(state);
      break;
    case "k":
      state.cursorLine = Math.max(0, state.cursorLine - count);
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
      const atLineEnd = state.cursorCol >= (line.length || 0) - 1;
      if (
        atLineEnd &&
        state.cursorLine < state.lines.length - 1 &&
        state.mode !== "visual-block"
      ) {
        state.cursorLine += 1;
        const nextLine = state.lines[state.cursorLine] || "";
        state.cursorCol = Math.min(
          Math.max(0, nextLine.length - 1),
          nextLine.length - 1
        );
      } else {
        state.cursorCol = findWordBoundary(
          line,
          state.cursorCol,
          keystroke as any
        );
      }
      break;
    }
    case "(":
      {
        const pos = findSentenceStartBackward(
          state.lines,
          state.cursorLine,
          state.cursorCol
        );
        state.cursorLine = pos.line;
        state.cursorCol = pos.col;
        clampCursor(state);
      }
      break;
    case ")":
      {
        const pos = findSentenceStartForward(
          state.lines,
          state.cursorLine,
          state.cursorCol
        );
        state.cursorLine = pos.line;
        state.cursorCol = pos.col;
        clampCursor(state);
      }
      break;
    case "e":
    case "E":
    case "b":
    case "B": {
      const line = state.lines[state.cursorLine];
      if (
        (keystroke === "b" || keystroke === "B") &&
        state.mode === "visual-block" &&
        state.cursorCol === 0 &&
        state.cursorLine > 0
      ) {
        state.cursorLine--;
        const prevLine = state.lines[state.cursorLine] || "";
        state.cursorCol = findWordBoundary(
          prevLine,
          prevLine.length,
          keystroke as "b" | "B"
        );
        // if (state.visualStart && state.cursorLine < state.visualStart.line) {
        //   state.visualStart = {
        //     line: state.cursorLine,
        //     col: state.visualStart.col,
        //   };
        // }
        break;
      }
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

  // Handle o and O in visual modes (swap anchor)
  if (keystroke === "o") {
    // o swaps cursor with visualStart (go to other end)
    if (state.visualStart) {
      const tempLine = state.cursorLine;
      const tempCol = state.cursorCol;
      state.cursorLine = state.visualStart.line;
      state.cursorCol = state.visualStart.col;
      state.visualStart = { line: tempLine, col: tempCol };
      clampCursor(state);
    }
    return state;
  }

  if (keystroke === "O" && state.mode === "visual-block") {
    // O in visual-block: swap horizontal position (to other corner)
    if (state.visualStart) {
      const tempCol = state.cursorCol;
      state.cursorCol = state.visualStart.col;
      state.visualStart = { line: state.visualStart.line, col: tempCol };
      clampCursor(state);
    }
    return state;
  }

  // Fallback: direct text input in visual-block mode (append across selection)
  if (
    state.mode === "visual-block" &&
    range &&
    keystroke.length === 1 &&
    !["d", "x", "c", "y", ">", "<", "A", "I"].includes(keystroke) &&
    ![
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
      "$",
      "^",
      "G",
      "g",
      "n",
      "N",
      "*",
      "#",
      "%",
      "?",
      "/",
      "<CR>",
      "<Enter>",
      "<Esc>",
      "<C-c>",
    ].includes(keystroke)
  ) {
    if (!state.visualBlockWaitingInsert) {
      saveUndo(state);
      state.visualBlockWaitingInsert = true;
    }
    const endCol = Math.max(range.startCol, range.endCol);
    const ragged = state.visualBlockRagged;
    for (let line = range.startLine; line <= range.endLine; line++) {
      let text = state.lines[line] || "";
      const insertCol = ragged ? text.length : endCol + 1;
      if (text.length < insertCol) {
        text = text.padEnd(insertCol, " ");
      }
      state.lines[line] =
        text.slice(0, insertCol) + keystroke + text.slice(insertCol);
    }
    state.cursorCol = ragged
      ? (state.lines[state.cursorLine]?.length ?? 1) - 1
      : endCol + 1;
    return state;
  }

  return state;
}
