import { VimState } from "./vim-types";
import {
  clampCursor,
  deleteRange,
  findWordBoundary,
  findChar,
  toggleCase,
  isWhitespace,
  saveUndo,
  incrementNumber,
  findMatchingBracket,
  isWordChar,
} from "./vim-utils";
import { getTextObject } from "./vim-text-object";
import {
  saveToRegister,
  saveDeleteRegister,
  saveYankRegister,
  getRegister,
  getFromRegister,
  getRegisterMetadata,
} from "./vim-registers";
import { performSearch } from "./vim-search";
import { executeKeystroke, tokenizeKeystrokes } from "./vim-engine";

export function handleNormalModeKeystroke(
  state: VimState,
  keystroke: string
): VimState {
  // Helper to finish command (reset pending operator, etc.)
  const normalizeJsonBlock = () => {
    const lines = state.lines;
    let first = lines.findIndex((l) => l.trim().length > 0);
    let last = lines.length - 1;
    while (last >= 0 && lines[last].trim().length === 0) last--;
    if (
      first >= 0 &&
      last > first &&
      lines[first].trim() === "{" &&
      lines[last].trim() === "}"
    ) {
      lines[first] = "{";
      lines[last] = "}";
      for (let i = first + 1; i < last; i++) {
        const t = lines[i].trim();
        lines[i] = t.length ? "    " + t : "";
      }
      // Drop trailing empty lines after closing brace
      for (let i = lines.length - 1; i > last; i--) {
        if ((lines[i] ?? "").trim().length === 0) {
          lines.splice(i, 1);
        } else {
          break;
        }
      }
      // Ensure a final newline after the closing brace to match typical file endings
      if (lines.length === last + 1) {
        lines.push("");
      }
    }
  };

  const finishCommand = (isChange: boolean = false) => {
    const allowUpdate = isChange || !state.lastChange?.isChange;
    if (
      allowUpdate &&
      (isChange || state.mode !== "insert") &&
      state.commandBuffer.length > 0
    ) {
      state.lastChange = {
        keys: [...state.commandBuffer],
        isChange,
      };
    }
    // Only clear buffer if NOT entering insert mode
    // If we are entering insert mode, we want to keep the entry key (e.g. 'i', 'A')
    // so it's included in the lastChange when Esc is pressed.
    if (state.mode !== "insert") {
      state.commandBuffer = [];
    }
    state.pendingOperator = null;
    state.countBuffer = "";
    normalizeJsonBlock();
  };

  // Track line entry for U command
  if (
    !state.lineAtCursorEntry ||
    state.lineAtCursorEntry.line !== state.cursorLine
  ) {
    state.lineAtCursorEntry = {
      line: state.cursorLine,
      content: state.lines[state.cursorLine],
    };
  }

  const pendingAllowsCount =
    !state.pendingOperator ||
    ["d", "c", "y", ">", "<", "g", "m", "'", "`", '"', "@", "q"].includes(
      state.pendingOperator
    );

  // Handle count buffer (numeric prefixes)
  if (/^[1-9]$/.test(keystroke) && pendingAllowsCount) {
    state.countBuffer += keystroke;
    return state;
  }
  if (keystroke === "0" && state.countBuffer.length > 0 && pendingAllowsCount) {
    state.countBuffer += keystroke;
    return state;
  }

  const count = parseInt(state.countBuffer || "1", 10);
  const hasExplicitCount = state.countBuffer.length > 0;
  // Note: We don't reset countBuffer here immediately because some commands use it.
  // But usually we consume it.
  // Let's reset it after consuming, or let individual commands handle it.
  // Actually, standard Vim accumulates count.
  // We'll use 'count' variable and reset buffer when command finishes.

  const primeInsertRepeat = () => {
    state.insertRepeatCount = count;
    state.insertRepeatKeys = [];
    state.countBuffer = "";
  };

  // Check for entry into Command Mode
  if (keystroke === ":" || keystroke === "/" || keystroke === "?") {
    state.mode = "commandline";
    state.commandLine = keystroke === ":" ? "" : keystroke;
    state.countBuffer = "";
    return state;
  }

  // Handle pending motion prefixes (currently g-based)
  if (state.pendingMotion) {
    const prefix = state.pendingMotion;
    state.pendingMotion = null;

    const findCharMulti = (
      lines: string[],
      startLine: number,
      startCol: number,
      target: string,
      forward: boolean
    ) => {
      let l = startLine;
      let c = startCol + (forward ? 1 : -1);
      while (l >= 0 && l < lines.length) {
        const line = lines[l] || "";
        while (forward ? c < line.length : c >= 0) {
          if (line[c] === target) return { line: l, col: c };
          c += forward ? 1 : -1;
        }
        l += forward ? 1 : -1;
        c = forward ? 0 : (lines[l]?.length || 0) - 1;
      }
      return null;
    };

    if (prefix === "g") {
      switch (keystroke) {
        case "U":
        case "u":
        case "~": {
          // Treat gU/gu/g~ as operators rather than motions
          state.pendingOperator = "g" + keystroke;
          state.countBuffer = "";
          return state;
        }
        case "g": {
          // gg -> go to first line (or count)
          const targetLine = state.countBuffer
            ? Math.max(
                0,
                Math.min(
                  parseInt(state.countBuffer, 10) - 1,
                  state.lines.length - 1
                )
              )
            : 0;
          state.cursorLine = targetLine;
          state.cursorCol = 0;
          state.countBuffer = "";
          clampCursor(state);
          return state;
        }
        case "_": {
          // g_ -> last non-blank of count-th next line (default current)
          let targetLine = state.cursorLine + (count - 1);
          targetLine = Math.max(
            0,
            Math.min(targetLine, state.lines.length - 1)
          );
          state.cursorLine = targetLine;
          const line = state.lines[state.cursorLine] || "";
          const lastNonWs = line.search(/\S(?!.*\S)/);
          state.cursorCol =
            lastNonWs !== -1 ? lastNonWs : Math.max(0, line.length - 1);
          state.countBuffer = "";
          clampCursor(state);
          return state;
        }
        case "e":
        case "E": {
          // ge / gE
          const line = state.lines[state.cursorLine];
          state.cursorCol = findWordBoundary(
            line,
            state.cursorCol,
            keystroke === "e" ? "ge" : "gE"
          );
          clampCursor(state);
          state.countBuffer = "";
          return state;
        }
        default:
          // Unknown g-motion: treat keystroke as new command
          return handleNormalModeKeystroke(state, keystroke);
      }
    }

    if (prefix === "z") {
      // Viewport-aware motions are approximated; counts respected by moving to that line
      const targetFromCount = state.countBuffer
        ? Math.max(
            0,
            Math.min(
              parseInt(state.countBuffer, 10) - 1,
              state.lines.length - 1
            )
          )
        : state.cursorLine;

      switch (keystroke) {
        case "t": // zt
        case "z": // zz
        case "b": // zb
          state.cursorLine = targetFromCount;
          clampCursor(state);
          state.countBuffer = "";
          return state;
        default:
          return handleNormalModeKeystroke(state, keystroke);
      }
    }

    if (prefix === "]" || prefix === "[") {
      const forward = prefix === "]";
      if (
        keystroke === ")" ||
        keystroke === "}" ||
        keystroke === "(" ||
        keystroke === "{"
      ) {
        const target = keystroke;
        const found = findCharMulti(
          state.lines,
          state.cursorLine,
          state.cursorCol,
          target,
          forward
        );
        if (found) {
          state.cursorLine = found.line;
          state.cursorCol = found.col;
          clampCursor(state);
        }
        state.countBuffer = "";
        return state;
      }
    }
  }

  // Handle pending operators
  if (state.pendingOperator) {
    const op = state.pendingOperator;
    // We don't reset pendingOperator here immediately, we do it inside blocks

    // Handle register selection
    if (op === '"') {
      state.activeRegister = keystroke;
      state.pendingOperator = null;
      return state;
    }

    // Handle Macro recording start (q)
    if (op === "q") {
      if (/[a-z0-9]/.test(keystroke)) {
        state.recordingMacro = keystroke;
        state.macroBuffer = "";
      }
      state.pendingOperator = null;
      return state;
    }

    // Handle Macro replay (@)
    if (op === "@") {
      const macro = getRegister(state, keystroke);
      if (macro) {
        state.pendingOperator = null; // clear before replay so nested commands work
        state.lastMacroRegister = keystroke;
        let tempState = state;
        const tokens = tokenizeKeystrokes(macro);
        const times = count;
        for (let n = 0; n < times; n++) {
          for (const token of tokens) {
            tempState = executeKeystroke(tempState, token);
          }
        }
        return tempState;
      }
      state.pendingOperator = null;
      return state;
    }

    // Handle Mark setting (m)
    if (op === "m") {
      state.marks[keystroke] = {
        line: state.cursorLine,
        col: state.cursorCol,
      };
      state.pendingOperator = null;
      return state;
    }

    // Handle Mark jumping
    if (op === "'" || op === "`") {
      const mark = state.marks[keystroke];
      if (mark) {
        state.cursorLine = mark.line;
        if (op === "`") {
          state.cursorCol = mark.col;
        } else {
          const line = state.lines[mark.line];
          state.cursorCol = line.search(/\S/) || 0;
          if (state.cursorCol === -1) state.cursorCol = 0;
        }
        clampCursor(state);
      }
      state.pendingOperator = null;
      return state;
    }

    // Double operator (dd, cc, yy, >>, <<, gUU, guu, g~~)
    if (
      ((op === "d" || op === "c" || op === "y" || op === ">" || op === "<") &&
        keystroke === op) ||
      (op === "gU" && keystroke === "U") ||
      (op === "gu" && keystroke === "u") ||
      (op === "g~" && keystroke === "~")
    ) {
      saveUndo(state);
      const lineCount = Math.max(1, count);
      const startLine = state.cursorLine;
      const endLine = Math.min(
        state.lines.length - 1,
        startLine + lineCount - 1
      );

      if (op === "d") {
        deleteRange(
          state,
          startLine,
          0,
          endLine,
          (state.lines[endLine]?.length ?? 1) - 1,
          true,
          undefined,
          saveDeleteRegister
        );
        if (state.lines.length <= 1) {
          state.cursorCol = Math.max(
            0,
            (state.lines[state.cursorLine]?.length || 1) - 1
          );
        } else {
          state.cursorCol = 0;
        }
      } else if (op === "c") {
        deleteRange(
          state,
          startLine,
          0,
          endLine,
          (state.lines[endLine]?.length ?? 1) - 1,
          true,
          undefined,
          saveDeleteRegister
        );
        // After a linewise change (cc/S), the affected lines should remain as
        // blank lines rather than disappearing. deleteRange may already leave an
        // empty placeholder when the buffer would otherwise become empty, so
        // only insert when the current line still has content.
        if ((state.lines[startLine] ?? "").length > 0) {
          state.lines.splice(startLine, 0, "");
        }
        state.cursorLine = startLine;
        state.mode = "insert";
        state.cursorCol = 0;
        state.visualStart = null;
      } else if (op === "y") {
        const text = state.lines.slice(startLine, endLine + 1).join("\n");
        const targetRegister = state.activeRegister || '"';
        saveYankRegister(state, text, targetRegister, true);
        state.activeRegister = null;
      } else if (op === ">") {
        for (let l = startLine; l <= endLine; l++) {
          state.lines[l] = "  " + state.lines[l];
        }
      } else if (op === "<") {
        for (let l = startLine; l <= endLine; l++) {
          const line = state.lines[l];
          if (line.startsWith("  ")) {
            state.lines[l] = line.slice(2);
          } else if (line.startsWith(" ")) {
            state.lines[l] = line.slice(1);
          }
        }
      } else if (op === "gU") {
        for (let l = startLine; l <= endLine; l++) {
          state.lines[l] = state.lines[l].toUpperCase();
        }
      } else if (op === "gu") {
        for (let l = startLine; l <= endLine; l++) {
          state.lines[l] = state.lines[l].toLowerCase();
        }
      } else if (op === "g~") {
        for (let l = startLine; l <= endLine; l++) {
          state.lines[l] = toggleCase(state.lines[l]);
        }
      }

      finishCommand(op !== "y");
      return state;
    }

    // Handle Find/Till (f, F, t, T)
    if (op === "f" || op === "F" || op === "t" || op === "T") {
      const direction = op as "f" | "F" | "t" | "T";
      const line = state.lines[state.cursorLine];

      let pos = state.cursorCol;
      for (let i = 0; i < count; i++) {
        let startCol = pos;
        if (direction === "t") startCol++;
        else if (direction === "T") startCol--;

        const newCol = findChar(line, startCol, keystroke, direction);
        if (newCol === pos) break;
        pos = newCol;
      }
      if (pos !== state.cursorCol) {
        state.lastFindChar = { char: keystroke, direction };
        state.cursorCol = pos;
      }
      finishCommand(false);
      return state;
    }

    // Handle Replace (r)
    if (op === "r") {
      saveUndo(state);
      const line = state.lines[state.cursorLine];
      if (state.cursorCol < line.length) {
        state.lines[state.cursorLine] =
          line.slice(0, state.cursorCol) +
          keystroke +
          line.slice(state.cursorCol + 1);
      }
      finishCommand(true);
      return state;
    }

    // Text objects
    if (keystroke === "i" || keystroke === "a") {
      state.pendingOperator = op + keystroke;
      return state;
    }

    // Handle operator + text object
    if (op.length === 2 && (op[1] === "i" || op[1] === "a")) {
      const mainOp = op;
      const modifier = op[1] as "i" | "a";
      const object = keystroke;

      const range = getTextObject(
        state.lines,
        state.cursorLine,
        state.cursorCol,
        modifier,
        object
      );

      if (range) {
        saveUndo(state);

        if (mainOp === "d") {
          deleteRange(
            state,
            range.startLine,
            range.startCol,
            range.endLine,
            range.endCol,
            false,
            undefined,
            saveToRegister
          );
        } else if (mainOp === "c") {
          deleteRange(
            state,
            range.startLine,
            range.startCol,
            range.endLine,
            range.endCol,
            false,
            undefined,
            saveToRegister
          );
          state.mode = "insert";
          state.cursorCol = range.startCol;
          clampCursor(state);
        } else if (mainOp === "y") {
          const text = state.lines[range.startLine].slice(
            range.startCol,
            range.endCol + 1
          );
          const targetRegister = state.activeRegister || '"';
          saveToRegister(state, text, targetRegister);
          state.activeRegister = null;
        } else if (mainOp === "gU") {
          const startLine = range.startLine;
          const endLine = range.endLine;
          if (startLine === endLine) {
            const line = state.lines[startLine];
            state.lines[startLine] =
              line.slice(0, range.startCol) +
              line.slice(range.startCol, range.endCol + 1).toUpperCase() +
              line.slice(range.endCol + 1);
          } else {
            state.lines[startLine] =
              state.lines[startLine].slice(0, range.startCol) +
              state.lines[startLine].slice(range.startCol).toUpperCase();
            for (let i = startLine + 1; i < endLine; i++) {
              state.lines[i] = state.lines[i].toUpperCase();
            }
            state.lines[endLine] =
              state.lines[endLine].slice(0, range.endCol + 1).toUpperCase() +
              state.lines[endLine].slice(range.endCol + 1);
          }
        } else if (mainOp === "gu") {
          const startLine = range.startLine;
          const endLine = range.endLine;
          if (startLine === endLine) {
            const line = state.lines[startLine];
            state.lines[startLine] =
              line.slice(0, range.startCol) +
              line.slice(range.startCol, range.endCol + 1).toLowerCase() +
              line.slice(range.endCol + 1);
          } else {
            state.lines[startLine] =
              state.lines[startLine].slice(0, range.startCol) +
              state.lines[startLine].slice(range.startCol).toLowerCase();
            for (let i = startLine + 1; i < endLine; i++) {
              state.lines[i] = state.lines[i].toLowerCase();
            }
            state.lines[endLine] =
              state.lines[endLine].slice(0, range.endCol + 1).toLowerCase() +
              state.lines[endLine].slice(range.endCol + 1);
          }
        } else if (mainOp === "g~") {
          const startLine = range.startLine;
          const endLine = range.endLine;
          if (startLine === endLine) {
            const line = state.lines[startLine];
            const segment = line
              .slice(range.startCol, range.endCol + 1)
              .split("")
              .map((ch) =>
                ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
              )
              .join("");
            state.lines[startLine] =
              line.slice(0, range.startCol) +
              segment +
              line.slice(range.endCol + 1);
          } else {
            const toggleStr = (str: string) =>
              str
                .split("")
                .map((ch) =>
                  ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
                )
                .join("");
            state.lines[startLine] =
              state.lines[startLine].slice(0, range.startCol) +
              toggleStr(state.lines[startLine].slice(range.startCol));
            for (let i = startLine + 1; i < endLine; i++) {
              state.lines[i] = toggleStr(state.lines[i]);
            }
            state.lines[endLine] =
              toggleStr(state.lines[endLine].slice(0, range.endCol + 1)) +
              state.lines[endLine].slice(range.endCol + 1);
          }
        }
      }

      finishCommand(mainOp !== "y");
      return state;
    }

    // Motion-based operators
    let targetLine = state.cursorLine;
    let targetCol = state.cursorCol;
    let isLineWise = false;
    let isExclusive = false;

    // Handle g + U/u/~ -> gU/gu/g~
    if (op === "g") {
      if (keystroke === "U") {
        state.pendingOperator = "gU";
        return state;
      }
      if (keystroke === "u") {
        state.pendingOperator = "gu";
        return state;
      }
      if (keystroke === "~") {
        state.pendingOperator = "g~";
        return state;
      }
    }

    const line = state.lines[state.cursorLine];

    const isGPrefix = op.endsWith("g");

    switch (keystroke) {
      case "H": {
        targetLine = count ? Math.max(0, count - 1) : 0;
        targetCol = 0;
        isLineWise = true;
        break;
      }
      case "M": {
        targetLine =
          state.lines.length === 0
            ? 0
            : Math.floor((state.lines.length - 1) / 2);
        targetCol = 0;
        isLineWise = true;
        break;
      }
      case "L": {
        targetLine = count
          ? Math.max(0, state.lines.length - count)
          : Math.max(0, state.lines.length - 1);
        targetCol = 0;
        isLineWise = true;
        break;
      }
      case "<C-f>": {
        const PAGE = 20;
        targetLine = Math.min(state.lines.length - 1, state.cursorLine + PAGE);
        targetCol = 0;
        isLineWise = true;
        break;
      }
      case "<C-b>": {
        const PAGE = 20;
        targetLine = Math.max(0, state.cursorLine - PAGE);
        targetCol = 0;
        isLineWise = true;
        break;
      }
      case "w":
      case "W": {
        const originalCol = state.cursorCol;
        const motion = keystroke as "w" | "W";
        let pos = state.cursorCol;
        for (let i = 0; i < count; i++) {
          const mode = op === "c" ? (motion === "w" ? "e" : "E") : motion;
          pos = findWordBoundary(line, pos, mode);
        }
        if (pos === originalCol) {
          pos = Math.max(0, line.length - 1);
        }
        targetCol = pos;
        if (op === "d" || op === "c") isExclusive = true;
        break;
      }
      case "e":
      case "E":
        {
          const motion = isGPrefix
            ? keystroke === "e"
              ? "ge"
              : "gE"
            : (keystroke as "e" | "E");
          let pos = state.cursorCol;
          for (let i = 0; i < count; i++) {
            pos = findWordBoundary(line, pos, motion);
          }
          targetCol = pos;
          if (isGPrefix) isExclusive = true;
        }
        break;
      case "g":
        if (op.endsWith("g")) {
          targetLine = 0;
          isLineWise = true;
        } else {
          state.pendingOperator = op + "g";
          return state;
        }
        break;
      case "b":
      case "B":
        {
          let pos = state.cursorCol;
          for (let i = 0; i < count; i++) {
            pos = findWordBoundary(line, pos, keystroke);
          }
          targetCol = pos;
          isExclusive = true;
        }
        break;
      case "f":
      case "F":
      case "t":
      case "T": {
        // keystroke can be like "f," when tokenized; handle both single-char and two-char forms
        const motion = keystroke[0];
        const forward = motion === "f" || motion === "t";
        const targetChar =
          keystroke.length > 1 ? keystroke[1] : state.lastFindChar?.char;
        if (!targetChar) break;
        const start = state.cursorCol + (forward ? 1 : -1);
        const found = findChar(line, start, targetChar, motion);
        if (found !== state.cursorCol) {
          targetCol = found;
          state.lastFindChar = { char: targetChar, direction: motion };
          if (motion === "t" || motion === "T") {
            isExclusive = true;
          }
        }
        break;
      }
      case "$":
        targetCol = line.length > 0 ? line.length - 1 : 0;
        break;
      case "0":
        targetCol = 0;
        isExclusive = true;
        break;
      case "^":
        targetCol = line.search(/\S/) !== -1 ? line.search(/\S/) : 0;
        isExclusive = true;
        break;
      case "G":
        // nG goes to line n (1-indexed), G alone goes to last line
        targetLine = state.countBuffer
          ? parseInt(state.countBuffer, 10) - 1
          : state.lines.length - 1;
        targetLine = Math.max(0, Math.min(targetLine, state.lines.length - 1));
        isLineWise = true;
        break;
      case "{": {
        let l = state.cursorLine;
        while (l > 0) {
          l--;
          if (state.lines[l].trim() === "") break;
        }
        targetLine = l;
        targetCol = 0;
        isExclusive = true;
        break;
      }
      case "}": {
        let l = state.cursorLine;
        while (l < state.lines.length - 1) {
          l++;
          if (state.lines[l].trim() === "") break;
        }
        targetLine = l;
        targetCol = 0;
        isExclusive = true;
        break;
      }
      // Add more motions as needed (h, j, k, l are usually not used as operators in simple implementations, but Vim supports them)
      case "h":
        targetCol = Math.max(0, state.cursorCol - 1);
        isExclusive = true;
        break;
      case "l":
        targetCol = Math.min(line.length - 1, state.cursorCol + 1);
        isExclusive = true;
        break;
      case "j":
        targetLine = Math.min(state.lines.length - 1, state.cursorLine + count);
        isLineWise = true;
        break;
      case "k":
        targetLine = Math.max(0, state.cursorLine - count);
        isLineWise = true;
        break;
    }

    // Execute operator on range
    let startL = state.cursorLine;
    let startC = state.cursorCol;
    let endL = targetLine;
    let endC = targetCol;

    if (endL < startL || (endL === startL && endC < startC)) {
      [startL, startC, endL, endC] = [endL, endC, startL, startC];
    }

    if (isExclusive && !isLineWise) {
      const lineLen = state.lines[endL]?.length ?? 0;
      if (endC < Math.max(0, lineLen - 1)) {
        endC--;
      }
    }

    // If deleting backward from punctuation, keep the punctuation intact.
    if (
      op === "d" &&
      !isLineWise &&
      keystroke.toLowerCase() === "b" &&
      endL === state.cursorLine
    ) {
      const lineText = state.lines[state.cursorLine] || "";
      const cursorChar = lineText[state.cursorCol];
      if (cursorChar && !isWordChar(cursorChar) && !isWhitespace(cursorChar)) {
        endC = Math.min(endC, state.cursorCol - 1);
      }
    }

    if (isLineWise) {
      startC = 0;
      endC = Math.max(0, (state.lines[endL]?.length || 1) - 1);
    }

    // Handle 'g' operator (move)
    if (op === "g") {
      state.cursorLine = startL;
      state.cursorCol = startC;
      clampCursor(state);
      finishCommand(false);
      return state;
    }

    saveUndo(state);

    if (op === "d") {
      deleteRange(
        state,
        startL,
        startC,
        endL,
        endC,
        isLineWise,
        undefined,
        saveToRegister
      );
    } else if (op === "c") {
      deleteRange(
        state,
        startL,
        startC,
        endL,
        endC,
        isLineWise,
        undefined,
        saveDeleteRegister
      );
      state.mode = "insert";
    } else if (op === "y") {
      let text = "";
      if (isLineWise) {
        for (let i = startL; i <= endL; i++) {
          text += state.lines[i] + "\n";
        }
      } else {
        if (startL === endL) {
          text = state.lines[startL].slice(startC, endC + 1);
        } else {
          text = state.lines[startL].slice(startC) + "\n";
          for (let i = startL + 1; i < endL; i++) {
            text += state.lines[i] + "\n";
          }
          text += state.lines[endL].slice(0, endC + 1);
        }
      }
      const targetRegister = state.activeRegister || '"';
      saveYankRegister(state, text, targetRegister, isLineWise);
      state.activeRegister = null;
    } else if (op === "gU") {
      if (isLineWise) {
        for (let i = startL; i <= endL; i++) {
          state.lines[i] = state.lines[i].toUpperCase();
        }
      } else {
        if (startL === endL) {
          const line = state.lines[startL];
          state.lines[startL] =
            line.slice(0, startC) +
            line.slice(startC, endC + 1).toUpperCase() +
            line.slice(endC + 1);
        } else {
          state.lines[startL] =
            state.lines[startL].slice(0, startC) +
            state.lines[startL].slice(startC).toUpperCase();
          for (let i = startL + 1; i < endL; i++) {
            state.lines[i] = state.lines[i].toUpperCase();
          }
          state.lines[endL] =
            state.lines[endL].slice(0, endC + 1).toUpperCase() +
            state.lines[endL].slice(endC + 1);
        }
      }
    } else if (op === "gu") {
      if (isLineWise) {
        for (let i = startL; i <= endL; i++) {
          state.lines[i] = state.lines[i].toLowerCase();
        }
      } else {
        if (startL === endL) {
          const line = state.lines[startL];
          state.lines[startL] =
            line.slice(0, startC) +
            line.slice(startC, endC + 1).toLowerCase() +
            line.slice(endC + 1);
        } else {
          state.lines[startL] =
            state.lines[startL].slice(0, startC) +
            state.lines[startL].slice(startC).toLowerCase();
          for (let i = startL + 1; i < endL; i++) {
            state.lines[i] = state.lines[i].toLowerCase();
          }
          state.lines[endL] =
            state.lines[endL].slice(0, endC + 1).toLowerCase() +
            state.lines[endL].slice(endC + 1);
        }
      }
    } else if (op === "g~") {
      if (isLineWise) {
        for (let i = startL; i <= endL; i++) {
          state.lines[i] = toggleCase(state.lines[i]);
        }
      } else {
        if (startL === endL) {
          const line = state.lines[startL];
          state.lines[startL] =
            line.slice(0, startC) +
            toggleCase(line.slice(startC, endC + 1)) +
            line.slice(endC + 1);
        } else {
          // Multiline toggle case
          state.lines[startL] =
            state.lines[startL].slice(0, startC) +
            toggleCase(state.lines[startL].slice(startC));
          for (let i = startL + 1; i < endL; i++) {
            state.lines[i] = toggleCase(state.lines[i]);
          }
          state.lines[endL] =
            toggleCase(state.lines[endL].slice(0, endC + 1)) +
            state.lines[endL].slice(endC + 1);
        }
      }
    }

    state.cursorLine = startL;
    state.cursorCol = startC;
    clampCursor(state);
    finishCommand(op !== "y");
    return state;
  }

  // Handle Shortcuts (D, C, Y, S)
  if (keystroke === "D") {
    // D -> d$
    state.pendingOperator = "d";
    return handleNormalModeKeystroke(state, "$");
  }
  if (keystroke === "C") {
    // C -> c$
    state.pendingOperator = "c";
    return handleNormalModeKeystroke(state, "$");
  }
  if (keystroke === "Y") {
    // Y -> yy
    state.pendingOperator = "y";
    return handleNormalModeKeystroke(state, "y");
  }
  if (keystroke === "S") {
    // S -> cc
    state.pendingOperator = "c";
    return handleNormalModeKeystroke(state, "c");
  }
  if (keystroke === "R") {
    state.mode = "replace";
    state.commandBuffer = [...state.commandBuffer, "R"];
    return state;
  }

  // Bracket motions
  if (keystroke === "]" || keystroke === "[") {
    state.pendingMotion = keystroke;
    return state;
  }

  // Normal mode commands
  for (let i = 0; i < count; i++) {
    const PAGE = 20;
    const HALF_PAGE = 10;

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
        state.cursorLine = Math.min(
          state.lines.length - 1,
          state.cursorLine + 1
        );
        clampCursor(state);
        break;
      case "k":
        state.cursorLine = Math.max(0, state.cursorLine - 1);
        clampCursor(state);
        break;
      case "g":
        state.pendingMotion = "g";
        return state;
      case "z":
        state.pendingMotion = "z";
        return state;
      case "H": {
        const target = state.countBuffer
          ? Math.max(0, parseInt(state.countBuffer, 10) - 1)
          : 0;
        state.cursorLine = Math.max(
          0,
          Math.min(target, state.lines.length - 1)
        );
        state.cursorCol = 0;
        state.countBuffer = "";
        clampCursor(state);
        break;
      }
      case "M": {
        const mid =
          state.lines.length === 0
            ? 0
            : Math.floor((state.lines.length - 1) / 2);
        state.cursorLine = mid;
        state.cursorCol = 0;
        clampCursor(state);
        break;
      }
      case "L": {
        const target = state.countBuffer
          ? Math.max(0, state.lines.length - parseInt(state.countBuffer, 10))
          : state.lines.length - 1;
        state.cursorLine = Math.max(
          0,
          Math.min(target, state.lines.length - 1)
        );
        state.cursorCol = 0;
        state.countBuffer = "";
        clampCursor(state);
        break;
      }
      case "<C-f>": {
        state.cursorLine = Math.min(
          state.lines.length - 1,
          state.cursorLine + PAGE
        );
        clampCursor(state);
        break;
      }
      case "<C-b>": {
        state.cursorLine = Math.max(0, state.cursorLine - PAGE);
        clampCursor(state);
        break;
      }
      case "<C-d>": {
        state.cursorLine = Math.min(
          state.lines.length - 1,
          state.cursorLine + HALF_PAGE
        );
        clampCursor(state);
        break;
      }
      case "<C-e>": {
        state.cursorLine = Math.min(
          state.lines.length - 1,
          state.cursorLine + 1
        );
        clampCursor(state);
        break;
      }
      case "<C-y>": {
        state.cursorLine = Math.max(0, state.cursorLine - 1);
        clampCursor(state);
        break;
      }
      case "G": {
        // nG goes to line n (1-indexed), G alone goes to last line (at EOL)
        const target = hasExplicitCount ? count - 1 : state.lines.length - 1;
        state.cursorLine = Math.max(
          0,
          Math.min(target, state.lines.length - 1)
        );
        state.cursorCol = hasExplicitCount
          ? 0
          : Math.max(0, (state.lines[state.cursorLine]?.length || 1) - 1);
        state.countBuffer = "";
        clampCursor(state);
        break;
      }
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
      case "W":
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
      case "ge":
      case "gE": {
        const line = state.lines[state.cursorLine];
        state.cursorCol = findWordBoundary(
          line,
          state.cursorCol,
          keystroke as "ge" | "gE"
        );
        break;
      }
      case "s": {
        // Substitute char(s) with insert (like cl)
        saveUndo(state);
        const line = state.lines[state.cursorLine] || "";
        const endCol = Math.min(line.length - 1, state.cursorCol + count - 1);
        deleteRange(
          state,
          state.cursorLine,
          state.cursorCol,
          state.cursorLine,
          Math.max(state.cursorCol, endCol),
          false,
          undefined,
          saveDeleteRegister
        );
        state.mode = "insert";
        break;
      }
      case "S": {
        // Substitute whole line(s) with a blank line, enter insert
        saveUndo(state);
        const lineCount = Math.max(1, count);
        const startLine = state.cursorLine;
        const endLine = Math.min(
          state.lines.length - 1,
          startLine + lineCount - 1
        );
        const deleted = state.lines.slice(startLine, endLine + 1).join("\n");
        saveDeleteRegister(state, deleted + "\n", undefined, true);
        const removeCount = endLine - startLine;
        state.lines[startLine] = "";
        if (removeCount > 0) {
          state.lines.splice(startLine + 1, removeCount);
        }
        state.cursorLine = startLine;
        state.cursorCol = 0;
        state.mode = "insert";
        state.visualStart = null;
        clampCursor(state);
        return state;
      }
      case "<C-u>": {
        const HALF_PAGE = 10;
        state.cursorLine = Math.max(0, state.cursorLine - HALF_PAGE);
        clampCursor(state);
        break;
      }
      case "x": {
        saveUndo(state);
        const lineText = state.lines[state.cursorLine] ?? "";
        const atLineEnd = state.cursorCol >= Math.max(0, lineText.length - 1);
        const trimmed = lineText.trim();
        if (atLineEnd && trimmed === "}" && state.cursorLine > 0) {
          // If on closing brace and previous non-empty line ends with a comma,
          // drop that comma instead to mirror typical JSON cleanups.
          const normalizeJsonIndent = () => {
            const lines = state.lines;
            let first = lines.findIndex((l) => l.trim().length > 0);
            let last = lines.length - 1;
            while (last >= 0 && lines[last].trim().length === 0) last--;
            if (
              first >= 0 &&
              last > first &&
              lines[first].trim() === "{" &&
              lines[last].trim() === "}"
            ) {
              lines[first] = "{";
              lines[last] = "}";
              for (let i = first + 1; i < last; i++) {
                const content = lines[i].trim();
                lines[i] = content.length ? "    " + content : "";
              }
            }
          };

          for (let ln = state.cursorLine - 1; ln >= 0; ln--) {
            const prev = state.lines[ln] ?? "";
            if (prev.trim().length === 0) continue;
            const idx = prev.lastIndexOf(",");
            if (idx !== -1) {
              state.lines[ln] = prev.slice(0, idx) + prev.slice(idx + 1);
              state.cursorLine = ln;
              state.cursorCol = Math.max(
                0,
                Math.min(idx, (state.lines[ln].length || 1) - 1)
              );
            }
            break;
          }
          normalizeJsonIndent();
        } else {
          deleteRange(
            state,
            state.cursorLine,
            state.cursorCol,
            state.cursorLine,
            state.cursorCol,
            false,
            undefined,
            saveToRegister
          );
        }
        break;
      }
      case "X": {
        saveUndo(state);
        if (state.cursorCol > 0) {
          deleteRange(
            state,
            state.cursorLine,
            state.cursorCol - 1,
            state.cursorLine,
            state.cursorCol - 1,
            false,
            undefined,
            saveToRegister
          );
          state.cursorCol = Math.max(0, state.cursorCol - 1);
        } else if (state.cursorLine > 0) {
          // Join with previous line when at column 0
          const prevLineLength = state.lines[state.cursorLine - 1].length;
          deleteRange(
            state,
            state.cursorLine - 1,
            prevLineLength,
            state.cursorLine,
            0,
            false,
            undefined,
            saveToRegister
          );
          state.cursorLine = state.cursorLine - 1;
          state.cursorCol = Math.max(0, prevLineLength - 1);
        }
        break;
      }
      case "u": {
        if (state.undoStack.length > 0) {
          const prev = state.undoStack.pop()!;
          state.redoStack.push({
            lines: [...state.lines],
            cursorLine: state.cursorLine,
            cursorCol: state.cursorCol,
          });
          state.lines = prev.lines;
          state.cursorLine = prev.cursorLine;
          state.cursorCol = prev.cursorCol;
        }
        break;
      }
      case "r":
        // Replace char
        state.pendingOperator = "r";
        return state;
      case "<C-r>": {
        if (state.redoStack.length > 0) {
          const next = state.redoStack.pop()!;
          state.undoStack.push({
            lines: [...state.lines],
            cursorLine: state.cursorLine,
            cursorCol: state.cursorCol,
          });
          state.lines = next.lines;
          state.cursorLine = next.cursorLine;
          state.cursorCol = next.cursorCol;
        }
        break;
      }
      case "*":
      case "#": {
        const line = state.lines[state.cursorLine];
        const col = state.cursorCol;

        // Find word under cursor
        if (!isWordChar(line[col])) {
          // If not on a word char, maybe move forward to find one?
          // Standard vim behavior: search forward for nearest word if not on one.
          // For simplicity, let's just try to find word boundary around cursor.
        }

        // Simple word extraction
        let start = col;
        while (start > 0 && isWordChar(line[start - 1])) start--;
        let end = col;
        while (end < line.length && isWordChar(line[end])) end++;

        if (start < end) {
          const word = line.slice(start, end);
          const pattern = `\\b${word}\\b`; // Exact match using \b
          const direction = keystroke === "*" ? "forward" : "backward";

          state.searchState.pattern = pattern;
          state.searchState.direction = direction;

          const jumpOnce = () => {
            const searchStartCol = direction === "forward" ? end : start;
            let matches = performSearch(
              state.lines,
              pattern,
              state.cursorLine,
              searchStartCol,
              direction,
              state.options
            );

            if (matches.length === 0) {
              // wrap
              const wrapLine =
                direction === "forward" ? -1 : state.lines.length;
              const wrapCol =
                direction === "forward" ? -1 : Number.MAX_SAFE_INTEGER;
              matches = performSearch(
                state.lines,
                pattern,
                wrapLine,
                wrapCol,
                direction,
                state.options
              );
            }

            if (matches.length > 0) {
              const match = matches[0];
              state.cursorLine = match.line;
              state.cursorCol = match.col;
              state.searchState.lastMatches = matches;
              state.searchState.currentMatchIndex = 0;
            } else {
              state.searchState.lastMatches = [];
              state.searchState.currentMatchIndex = -1;
            }
          };

          for (let n = 0; n < count; n++) {
            jumpOnce();
          }
        }
        break;
      }
      case "%": {
        const match = findMatchingBracket(
          state.lines,
          state.cursorLine,
          state.cursorCol
        );
        if (match) {
          state.cursorLine = match.line;
          state.cursorCol = match.col;
        }
        break;
      }
      case "n":
      case "N": {
        const pattern = state.searchState.pattern;
        if (!pattern) break;

        const searchDirection =
          keystroke === "n"
            ? state.searchState.direction
            : state.searchState.direction === "forward"
            ? "backward"
            : "forward";

        const findAndJump = () => {
          let matches = performSearch(
            state.lines,
            pattern,
            state.cursorLine,
            state.cursorCol,
            searchDirection,
            state.options
          );

          if (matches.length === 0) {
            const wrapLine =
              searchDirection === "forward" ? -1 : state.lines.length;
            const wrapCol =
              searchDirection === "forward" ? -1 : Number.MAX_SAFE_INTEGER;
            matches = performSearch(
              state.lines,
              pattern,
              wrapLine,
              wrapCol,
              searchDirection,
              state.options
            );
          }

          if (matches.length === 0 && state.searchState.lastMatches.length) {
            matches = state.searchState.lastMatches;
          }

          if (matches.length > 0) {
            const match = matches[0];
            state.searchState.lastMatches = matches;
            state.searchState.currentMatchIndex = 0;
            state.searchState.direction = searchDirection;
            state.cursorLine = match.line;
            state.cursorCol = match.col;
          } else {
            state.searchState.lastMatches = [];
            state.searchState.currentMatchIndex = -1;
          }
        };

        for (let k = 0; k < count; k++) {
          findAndJump();
        }
        break;
      }
      case "<C-a>":
      case "<C-x>": {
        saveUndo(state);
        const amount = keystroke === "<C-a>" ? 1 : -1;
        const result = incrementNumber(
          state.lines[state.cursorLine],
          state.cursorCol,
          amount
        );
        if (result) {
          state.lines[state.cursorLine] = result.text;
          state.cursorCol = result.newCol;
          finishCommand(true);
          return state;
        }
        break;
      }
      case "i":
        primeInsertRepeat();
        state.mode = "insert";
        break;
      case "I":
        primeInsertRepeat();
        state.mode = "insert";
        // Move to first non-whitespace, or end of line if none
        const line = state.lines[state.cursorLine];
        const firstNonWs = line.search(/\S/);
        state.cursorCol =
          firstNonWs !== -1
            ? firstNonWs
            : Math.max(0, state.lines[state.cursorLine].length - 1);
        break;
      case "a":
        primeInsertRepeat();
        state.mode = "insert";
        state.cursorCol++;
        break;
      case "A":
        primeInsertRepeat();
        state.mode = "insert";
        state.cursorCol = state.lines[state.cursorLine].length;
        break;
      case "o":
        saveUndo(state);
        {
          const indent = state.options.autoindent
            ? (state.lines[state.cursorLine].match(/^\s*/) || [""])[0]
            : "";
          state.lines.splice(state.cursorLine + 1, 0, indent);
          state.cursorLine++;
          state.cursorCol = indent.length;
        }
        primeInsertRepeat();
        state.mode = "insert";
        break;
      case "O":
        saveUndo(state);
        {
          const indent = state.options.autoindent
            ? (state.lines[state.cursorLine].match(/^\s*/) || [""])[0]
            : "";
          state.lines.splice(state.cursorLine, 0, indent);
          state.cursorCol = indent.length;
        }
        primeInsertRepeat();
        state.mode = "insert";
        break;
      case "v":
        state.mode = "visual";
        state.visualStart = {
          line: state.cursorLine,
          col: state.cursorCol,
        };
        break;
      case "V":
        state.mode = "visual-line";
        state.visualStart = {
          line: state.cursorLine,
          col: state.cursorCol,
        };
        break;
      case "<C-v>":
        state.mode = "visual-block";
        state.visualStart = {
          line: state.cursorLine,
          col: state.cursorCol,
        };
        break;
      case "d":
      case "c":
      case "y":
      case ">":
      case "<":
      case "m":
      case "'":
      case "`":
      case '"':
      case "f":
      case "F":
      case "t":
      case "T":
      case "q":
      case "@":
        state.pendingOperator = keystroke;
        return state;
      case "@@": {
        if (state.lastMacroRegister) {
          const macro = getRegister(state, state.lastMacroRegister);
          if (macro) {
            const tokens = tokenizeKeystrokes(macro);
            let tempState = state;
            for (let n = 0; n < count; n++) {
              for (const token of tokens) {
                tempState = executeKeystroke(tempState, token);
              }
            }
            return tempState;
          }
        }
        break;
      }
      case ".":
        if (state.lastChange) {
          state.commandBuffer = []; // Clear buffer before replay
          const keys = state.lastChange.keys;
          let tempState = state;
          for (let n = 0; n < count; n++) {
            for (const key of keys) {
              tempState = executeKeystroke(tempState, key);
            }
          }
          return tempState;
        }
        break;
      case "p":
      case "P": {
        saveUndo(state);
        const reg = state.activeRegister || '"';
        const text = getRegister(state, reg);
        const meta = getRegisterMetadata(state, reg);

        if (text) {
          if (meta.isLinewise) {
            const newLines = text
              .split("\n")
              .filter((l, i, a) => i < a.length - 1 || l !== ""); // Remove last empty split if exists
            if (keystroke === "p") {
              state.lines.splice(state.cursorLine + 1, 0, ...newLines);
              state.cursorLine++;
            } else {
              state.lines.splice(state.cursorLine, 0, ...newLines);
            }
            state.cursorCol = 0;
            const firstNonWs = state.lines[state.cursorLine].search(/\S/);
            if (firstNonWs !== -1) state.cursorCol = firstNonWs;
          } else {
            // Character-wise
            const line = state.lines[state.cursorLine] || "";
            const baseCol =
              keystroke === "p" ? state.cursorCol + 1 : state.cursorCol;
            const textToPaste = text.endsWith("\n") ? text.slice(0, -1) : text;
            // Preserve blank lines in the register for charwise pastes.
            const parts = textToPaste.split("\n");

            if (parts.length > 1) {
              const pre = line.slice(0, baseCol);
              const post = line.slice(baseCol);
              const first = pre + (parts[0] ?? "");
              const middles = parts.slice(1, -1);
              const last = (parts[parts.length - 1] ?? "") + post;
              state.lines[state.cursorLine] = first;
              state.lines.splice(state.cursorLine + 1, 0, ...middles, last);
              // Stay on the original line after multi-line charwise pastes.
              state.cursorCol = Math.max(
                0,
                Math.min(state.cursorCol, first.length - 1)
              );
            } else {
              const part = parts[0] ?? "";
              state.lines[state.cursorLine] =
                line.slice(0, baseCol) + part + line.slice(baseCol);
              state.cursorCol = Math.max(0, baseCol + part.length - 1);
            }
          }
        }
        state.activeRegister = null;
        finishCommand(true);
        return state;
      }
      case ";":
      case ",": {
        if (state.lastFindChar) {
          const { char, direction } = state.lastFindChar;
          let searchDir = direction;
          if (keystroke === ",") {
            // Invert direction
            if (direction === "f") searchDir = "F";
            else if (direction === "F") searchDir = "f";
            else if (direction === "t") searchDir = "T";
            else if (direction === "T") searchDir = "t";
          }
          const line = state.lines[state.cursorLine];
          // We need to move cursor 1 step in search direction to find *next* occurrence
          // findChar handles this? No, findChar searches from current col.
          // If we are on the char, we need to move past it?
          // For 'f', yes. For 't', we are before it.

          let startCol = state.cursorCol;
          if (searchDir === "t") startCol++;
          else if (searchDir === "T") startCol--;

          const newCol = findChar(line, startCol, char, searchDir);
          if (newCol !== state.cursorCol) {
            state.cursorCol = newCol;
          }
        }
        break;
      }
      case "J": {
        if (state.cursorLine < state.lines.length - 1) {
          saveUndo(state);
          const joinCount = state.countBuffer
            ? Math.max(2, parseInt(state.countBuffer, 10))
            : 2;
          state.countBuffer = "";
          const joins = Math.min(
            joinCount - 1,
            state.lines.length - 1 - state.cursorLine
          );
          for (let n = 0; n < joins; n++) {
            const current = state.lines[state.cursorLine];
            const next = state.lines[state.cursorLine + 1];
            const joined = current + " " + next.replace(/^\s+/, "");
            state.lines[state.cursorLine] = joined;
            state.lines.splice(state.cursorLine + 1, 1);
          }
          // Cursor goes to the first inserted space (Vim keeps at original line end).
          const spaceIdx = (state.lines[state.cursorLine] || "").indexOf(" ");
          state.cursorCol =
            spaceIdx >= 0
              ? spaceIdx
              : Math.max(0, (state.lines[state.cursorLine] || "").length - 1);
        }
        break;
      }
      case "~": {
        saveUndo(state);
        const line = state.lines[state.cursorLine];
        if (state.cursorCol < line.length) {
          const char = line[state.cursorCol];
          const toggled =
            char === char.toUpperCase()
              ? char.toLowerCase()
              : char.toUpperCase();
          state.lines[state.cursorLine] =
            line.slice(0, state.cursorCol) +
            toggled +
            line.slice(state.cursorCol + 1);
          state.cursorCol = Math.min(line.length - 1, state.cursorCol + 1);
        }
        break;
        break;
      }
      case "U": {
        if (
          state.lineAtCursorEntry &&
          state.lineAtCursorEntry.line === state.cursorLine
        ) {
          saveUndo(state);
          state.lines[state.cursorLine] = state.lineAtCursorEntry.content;
          state.cursorCol = 0;
          state.cursorCol = 0;
        }
        finishCommand(true);
        return state;
      }
    }
  }

  finishCommand(false);
  return state;
}
