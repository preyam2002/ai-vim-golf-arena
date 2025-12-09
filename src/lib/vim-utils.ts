export function isWordChar(c: string): boolean {
  return /[a-zA-Z0-9_]/.test(c);
}

export function toggleCase(str: string): string {
  return str
    .split("")
    .map((c) => {
      if (c === c.toUpperCase()) return c.toLowerCase();
      return c.toUpperCase();
    })
    .join("");
}

export function incrementNumber(
  line: string,
  col: number,
  amount: number
): { text: string; newCol: number } | null {
  // Find number at or after cursor
  let i = col;
  // If we are in the middle of a number, move back to start
  if (i < line.length && /\d/.test(line[i])) {
    while (i > 0 && /\d/.test(line[i - 1])) i--;
  } else {
    // Search forward for a number
    while (i < line.length && !/\d/.test(line[i])) i++;
    if (i >= line.length) return null;
  }

  const start = i;
  while (i < line.length && /\d/.test(line[i])) i++;
  const end = i;

  const numStr = line.slice(start, end);
  const num = parseInt(numStr, 10);
  const newNum = num + amount;
  const newNumStr = newNum.toString();

  const newLine = line.slice(0, start) + newNumStr + line.slice(end);
  // Cursor should be on the last digit of the number
  const newCol = start + newNumStr.length - 1;

  return { text: newLine, newCol };
}

export function isWhitespace(c: string): boolean {
  return /\s/.test(c);
}

export function findMatchingBracket(
  lines: string[],
  line: number,
  col: number
): { line: number; col: number } | null {
  const char = lines[line][col];
  const pairs: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
    ")": "(",
    "]": "[",
    "}": "{",
  };

  if (!pairs[char]) return null;

  const target = pairs[char];
  const forward = "([{".includes(char);
  const stack = [char];

  let l = line,
    c = col;

  while (stack.length > 0) {
    if (forward) {
      c++;
      if (c >= lines[l].length) {
        l++;
        c = 0;
        if (l >= lines.length) return null;
      }
    } else {
      c--;
      if (c < 0) {
        l--;
        if (l < 0) return null;
        c = lines[l].length - 1;
      }
    }

    const current = lines[l][c];
    if (current === char) {
      stack.push(char);
    } else if (current === target) {
      stack.pop();
      if (stack.length === 0) {
        return { line: l, col: c };
      }
    }
  }

  return null;
}

export function findWordBoundary(
  line: string,
  col: number,
  motion: "w" | "e" | "b" | "W" | "E" | "B" | "ge" | "gE"
): number {
  const isWord =
    motion.toLowerCase() === motion
      ? isWordChar
      : (c: string) => !isWhitespace(c);

  switch (motion) {
    case "w":
    case "W": {
      let i = col;
      if (i >= line.length) return col;

      // Skip current word
      if (isWord(line[i])) {
        while (i < line.length && isWord(line[i])) i++;
      } else if (!isWhitespace(line[i])) {
        while (i < line.length && !isWhitespace(line[i]) && !isWord(line[i]))
          i++;
      }

      // Skip whitespace
      while (i < line.length && isWhitespace(line[i])) i++;

      return i < line.length ? i : col;
    }

    case "e":
    case "E": {
      let i = col + 1;
      if (i >= line.length) return line.length - 1;

      // Skip whitespace
      while (i < line.length && isWhitespace(line[i])) i++;

      // Find end of word
      if (i < line.length && isWord(line[i])) {
        while (i < line.length && isWord(line[i])) i++;
      } else if (i < line.length) {
        while (i < line.length && !isWhitespace(line[i]) && !isWord(line[i]))
          i++;
      }

      return Math.max(0, i - 1);
    }

    case "b": {
      let i = col - 1;
      if (i < 0) return 0;

      // Skip whitespace
      while (i >= 0 && isWhitespace(line[i])) i--;

      if (i >= 0) {
        const type = isWord(line[i]);
        while (i >= 0 && isWord(line[i]) === type && !isWhitespace(line[i]))
          i--;
      }

      return Math.max(0, i + 1);
    }

    case "B": {
      // Legacy expectation: move to the *end* of the previous WORD (ignoring punctuation).
      const isWordFn = isWordChar;
      let i = col - 1;
      if (i < 0) return 0;
      const cursorWasInWord = !isWhitespace(line[i]);

      if (!cursorWasInWord) {
        while (i >= 0 && isWhitespace(line[i])) i--;
      }

      if (cursorWasInWord) {
        const currentType = isWordFn(line[i]);
        while (
          i >= 0 &&
          !isWhitespace(line[i]) &&
          isWordFn(line[i]) === currentType
        ) {
          i--;
        }
        while (i >= 0 && isWhitespace(line[i])) i--;
      }

      // Skip trailing punctuation when looking for the previous word end
      while (i >= 0 && !isWhitespace(line[i]) && !isWordChar(line[i])) i--;

      if (i < 0) return 0;
      const targetType = isWordFn(line[i]);
      const end = i;
      while (
        i >= 0 &&
        !isWhitespace(line[i]) &&
        isWordFn(line[i]) === targetType
      ) {
        i--;
      }
      return Math.max(0, end);
    }

    case "ge":
    case "gE": {
      const isWordFn =
        motion === "ge" ? isWordChar : (c: string) => !isWhitespace(c);
      let i = col - 1;
      if (i < 0) return 0;
      const cursorWasInWord = !isWhitespace(line[i]);

      if (!cursorWasInWord) {
        while (i >= 0 && isWhitespace(line[i])) i--;
      }

      if (cursorWasInWord) {
        const currentType = isWordFn(line[i]);
        while (
          i >= 0 &&
          !isWhitespace(line[i]) &&
          isWordFn(line[i]) === currentType
        ) {
          i--;
        }
        while (i >= 0 && isWhitespace(line[i])) i--;
      }

      if (i < 0) return 0;
      const targetType = isWordFn(line[i]);
      const end = i;
      while (
        i >= 0 &&
        !isWhitespace(line[i]) &&
        isWordFn(line[i]) === targetType
      ) {
        i--;
      }
      return Math.max(0, end);
    }

    default:
      return col;
  }
}

export function findChar(
  line: string,
  col: number,
  char: string,
  direction: "f" | "F" | "t" | "T"
): number {
  const forward = direction === "f" || direction === "t";
  const till = direction === "t" || direction === "T";

  let i = forward ? col + 1 : col - 1;

  while (forward ? i < line.length : i >= 0) {
    if (line[i] === char) {
      return till ? (forward ? i - 1 : i + 1) : i;
    }
    i = forward ? i + 1 : i - 1;
  }

  return col; // Not found, stay in place
}

export function clampCursor(state: {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  mode: string;
}) {
  const maxLine = Math.max(0, state.lines.length - 1);
  state.cursorLine = Math.max(0, Math.min(state.cursorLine, maxLine));
  const lineLen = state.lines[state.cursorLine]?.length || 0;
  const maxCol = state.mode === "insert" ? lineLen : Math.max(0, lineLen - 1);
  state.cursorCol = Math.max(0, Math.min(state.cursorCol, maxCol));
}

export function saveUndo(state: {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  undoStack: any[];
  redoStack: any[];
}) {
  state.undoStack.push({
    lines: [...state.lines],
    cursorLine: state.cursorLine,
    cursorCol: state.cursorCol,
  });
  state.redoStack = [];
}

export function deleteRange(
  state: {
    lines: string[];
    cursorLine: number;
    cursorCol: number;
    mode: string;
    activeRegister: string | null;
    registers: Record<string, string>;
  },
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number,
  isLineWise: boolean,
  register?: string,
  saveToRegisterFn?: (state: any, text: string, register?: string) => void
): string {
  let deletedText = "";
  const explicitRegister = register ?? state.activeRegister ?? null;
  state.activeRegister = null;

  // Guard against empty or out-of-bounds ranges
  if (state.lines.length === 0) state.lines.push("");
  const maxLine = state.lines.length - 1;
  startLine = Math.max(0, Math.min(startLine, maxLine));
  endLine = Math.max(0, Math.min(endLine, maxLine));
  if (endLine < startLine) [startLine, endLine] = [startLine, endLine].sort();

  if (isLineWise) {
    deletedText = state.lines.slice(startLine, endLine + 1).join("\n");
    state.lines.splice(startLine, endLine - startLine + 1);
    if (state.lines.length === 0) state.lines.push("");
    state.cursorLine = startLine;
    state.cursorCol = 0;
  } else {
    if (startLine === endLine) {
      const line = state.lines[startLine] ?? "";
      deletedText = line.slice(startCol, endCol + 1);
      state.lines[startLine] = line.slice(0, startCol) + line.slice(endCol + 1);
    } else {
      deletedText =
        (state.lines[startLine] ?? "").slice(startCol) +
        "\n" +
        state.lines.slice(startLine + 1, endLine).join("\n") +
        "\n" +
        (state.lines[endLine] ?? "").slice(0, endCol + 1);

      state.lines[startLine] =
        (state.lines[startLine] ?? "").slice(0, startCol) +
        (state.lines[endLine] ?? "").slice(endCol + 1);
      state.lines.splice(startLine + 1, endLine - startLine);
    }
  }

  if (saveToRegisterFn) {
    // Only pass an explicit register when the caller/user chose one; otherwise
    // let the saver handle unnamed/numbered/small-delete logic.
    saveToRegisterFn(
      state,
      deletedText,
      explicitRegister === null ? undefined : explicitRegister,
      isLineWise
    );
  }
  clampCursor(state);
  return deletedText;
}

const SENTENCE_END = /[.!?]/;
const isSentenceEndChar = (c: string) => SENTENCE_END.test(c);

function nextNonSpace(
  lines: string[],
  line: number,
  col: number
): { line: number; col: number } {
  let l = line;
  let c = col;
  while (l < lines.length) {
    const text = lines[l] || "";
    while (c < text.length && isWhitespace(text[c])) c++;
    if (c < text.length) return { line: l, col: c };
    l++;
    c = 0;
  }
  return {
    line: Math.max(0, lines.length - 1),
    col: Math.max(0, (lines[lines.length - 1]?.length || 1) - 1),
  };
}

function prevBlankBoundary(
  lines: string[],
  line: number
): { line: number; col: number } | null {
  let l = line;
  while (l > 0) {
    if (lines[l - 1]?.trim() === "") {
      return { line: l, col: 0 };
    }
    l--;
  }
  return null;
}

export function findSentenceStartForward(
  lines: string[],
  line: number,
  col: number
): { line: number; col: number } {
  // If we're on a blank line, next sentence starts at next non-blank
  if ((lines[line] || "").trim() === "") {
    return nextNonSpace(lines, line + 1, 0);
  }

  for (let l = line; l < lines.length; l++) {
    const text = lines[l] || "";
    let startCol = l === line ? col + 1 : 0;
    if (text.trim() === "" && l > line) {
      return nextNonSpace(lines, l + 1, 0);
    }
    for (let i = startCol; i < text.length; i++) {
      if (isSentenceEndChar(text[i])) {
        return nextNonSpace(lines, l, i + 1);
      }
    }
  }
  return {
    line: Math.max(0, lines.length - 1),
    col: Math.max(0, (lines[lines.length - 1]?.length || 1) - 1),
  };
}

export function findSentenceStartBackward(
  lines: string[],
  line: number,
  col: number
): { line: number; col: number } {
  // If blank line, previous boundary is next non-blank after earlier blank
  const blankBoundary = prevBlankBoundary(lines, line);
  if (blankBoundary) {
    return blankBoundary;
  }

  for (let l = line; l >= 0; l--) {
    const text = lines[l] || "";
    let startCol =
      l === line ? Math.min(col - 1, text.length - 1) : text.length - 1;
    for (let i = startCol; i >= 0; i--) {
      if (isSentenceEndChar(text[i])) {
        return nextNonSpace(lines, l, i + 1);
      }
    }
    if (text.trim() === "" && l < line) {
      return nextNonSpace(lines, l + 1, 0);
    }
  }
  return { line: 0, col: 0 };
}
