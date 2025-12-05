import { VimState } from "./vim-types";
import { clampCursor, saveUndo } from "./vim-utils";

// Tokenizer for Vim expressions
enum TokenType {
  STRING,
  NUMBER,
  IDENTIFIER,
  OPERATOR,
  LPAREN,
  RPAREN,
  EOF,
}

interface Token {
  type: TokenType;
  value: string;
}

function evaluateVimExpression(
  expr: string,
  context: { line: number }
): string {
  let pos = 0;

  function peek(): string {
    return pos < expr.length ? expr[pos] : "";
  }

  function consume(): string {
    return pos < expr.length ? expr[pos++] : "";
  }

  function tokenize(): Token[] {
    const tokens: Token[] = [];
    while (pos < expr.length) {
      const char = peek();
      if (/\s/.test(char)) {
        consume();
      } else if (char === "'" || char === '"') {
        const quote = consume();
        let str = "";
        while (peek() !== quote && peek() !== "") {
          if (peek() === "\\") {
            consume();
            str += consume();
          } else {
            str += consume();
          }
        }
        consume(); // quote
        tokens.push({ type: TokenType.STRING, value: str });
      } else if (/\d/.test(char)) {
        let num = "";
        while (/\d/.test(peek())) num += consume();
        tokens.push({ type: TokenType.NUMBER, value: num });
      } else if (/[a-zA-Z_]/.test(char)) {
        let id = "";
        while (/[a-zA-Z0-9_:]/.test(peek())) id += consume();
        tokens.push({ type: TokenType.IDENTIFIER, value: id });
      } else if (char === "." || char === "+" || char === "-") {
        consume();
        tokens.push({ type: TokenType.OPERATOR, value: char });
      } else if (char === "(") {
        consume();
        tokens.push({ type: TokenType.LPAREN, value: "(" });
      } else if (char === ")") {
        consume();
        tokens.push({ type: TokenType.RPAREN, value: ")" });
      } else {
        consume(); // Skip unknown
      }
    }
    tokens.push({ type: TokenType.EOF, value: "" });
    return tokens;
  }

  // Reset pos for tokenization
  const tokens = tokenize();
  let tokenPos = 0;

  function peekToken(): Token {
    return tokens[tokenPos];
  }

  function consumeToken(): Token {
    return tokens[tokenPos++];
  }

  function parseExpression(): string {
    return parseConcat();
  }

  function parseConcat(): string {
    let left = parseAddSub();
    while (
      peekToken().type === TokenType.OPERATOR &&
      peekToken().value === "."
    ) {
      consumeToken();
      const right = parseAddSub();
      left += right;
    }
    return left;
  }

  function parseAddSub(): string {
    let left = parseTerm();
    while (
      peekToken().type === TokenType.OPERATOR &&
      (peekToken().value === "+" || peekToken().value === "-")
    ) {
      const op = consumeToken().value;
      const right = parseTerm();
      const leftNum = parseFloat(left);
      const rightNum = parseFloat(right);
      const result =
        isNaN(leftNum) || isNaN(rightNum)
          ? ""
          : op === "+"
          ? leftNum + rightNum
          : leftNum - rightNum;
      left = result.toString();
    }
    return left;
  }

  function parseTerm(): string {
    const token = consumeToken();
    if (token.type === TokenType.STRING) {
      return token.value;
    } else if (token.type === TokenType.NUMBER) {
      return token.value;
    } else if (token.type === TokenType.IDENTIFIER) {
      if (token.value === "line") {
        if (peekToken().type === TokenType.LPAREN) {
          consumeToken();
          const arg = parseExpression(); // Argument to line()
          consumeToken(); // RPAREN
          if (arg === ".") return context.line.toString();
          // TODO: Handle other line() args
          return context.line.toString();
        }
      } else if (token.value === "v:lnum") {
        return context.line.toString();
      }
      return "";
    } else if (token.type === TokenType.LPAREN) {
      const val = parseExpression();
      consumeToken(); // RPAREN
      return val;
    }
    return "";
  }

  return parseExpression();
}

function parseCommandRange(
  rangeStr: string,
  state: VimState
): { start: number; end: number } {
  if (!rangeStr) {
    return { start: state.cursorLine, end: state.cursorLine };
  }

  if (rangeStr === "%") {
    return { start: 0, end: state.lines.length - 1 };
  }

  const parts = rangeStr.split(",");
  if (parts.length === 1) {
    const line = parseLine(parts[0]);
    return { start: line, end: line };
  } else {
    return { start: parseLine(parts[0]), end: parseLine(parts[1]) };
  }

  function parseLine(s: string): number {
    if (s === ".") return state.cursorLine;
    if (s === "$") return state.lines.length - 1;
    if (s === "'<" && state.visualStart)
      return Math.min(state.visualStart.line, state.cursorLine);
    if (s === "'>" && state.visualStart)
      return Math.max(state.visualStart.line, state.cursorLine);
    if (/^\d+$/.test(s)) return parseInt(s, 10) - 1;
    if (s.includes("+")) {
      const [base, offset] = s.split("+");
      return parseLine(base) + parseInt(offset, 10);
    }
    if (s.includes("-")) {
      const [base, offset] = s.split("-");
      return parseLine(base) - parseInt(offset, 10);
    }
    return state.cursorLine;
  }
}

function expandExpressionRegisters(
  command: string,
  lineNumber: number
): string {
  let result = command;
  const marker = "<C-R>=";
  while (true) {
    const start = result.toLowerCase().indexOf(marker.toLowerCase());
    if (start === -1) break;
    const end = result.indexOf("<CR>", start + marker.length);
    if (end === -1) break;
    const expr = result.slice(start + marker.length, end);
    let evaluated = "";
    try {
      evaluated = evaluateVimExpression(expr, { line: lineNumber + 1 });
    } catch (e) {
      console.error("[VimEngine] Expression register error:", e);
    }
    result = result.slice(0, start) + evaluated + result.slice(end + 4);
  }
  return result;
}

export function executeExCommand(
  state: VimState,
  command: string,
  helpers?: {
    executeKeystroke: (s: VimState, k: string) => VimState;
    tokenizeKeystrokes: (ks: string) => string[];
  }
): VimState {
  const cmd = command.slice(1, -4); // Remove : and <CR>

  // Helper to finish command
  const finishCommand = (s: VimState) => {
    s.pendingOperator = null;
    s.countBuffer = "";
    s.commandLine = null;
    s.mode = "normal";
  };

  // :[range]normal commands
  const normalMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?norm(al)?!?\s+(.*)$/
  );
  if (normalMatch) {
    if (!helpers?.executeKeystroke || !helpers?.tokenizeKeystrokes) {
      console.warn("Normal command requested without keystroke helpers");
      finishCommand(state);
      return state;
    }

    saveUndo(state);
    const rangeStr = normalMatch[1];
    const normalCmd = normalMatch[3] || "";
    const { start, end } = parseCommandRange(rangeStr, state);

    for (let line = start; line <= end; line++) {
      state.cursorLine = Math.max(0, Math.min(line, state.lines.length - 1));
      state.cursorCol = 0;
      state.mode = "normal";
      state.pendingOperator = null;
      state.visualStart = null;
      state.countBuffer = "";

      const expanded = expandExpressionRegisters(normalCmd, line);
      const tokens = helpers.tokenizeKeystrokes(expanded);
      for (const token of tokens) {
        state = helpers.executeKeystroke(state, token);
      }
    }

    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Sort command :sort [u]
  const sortMatch = cmd.match(/^sort\s*(u)?$/);
  if (sortMatch) {
    saveUndo(state);
    const unique = sortMatch[1] === "u";
    let lines = [...state.lines];
    if (unique) {
      lines = [...new Set(lines)];
    }
    lines.sort();
    state.lines = lines;
    finishCommand(state);
    return state;
  }

  // Global command :[range]g/pat/d
  const globalMatch = cmd.match(/^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?g\/(.+?)\/d$/);
  if (globalMatch) {
    saveUndo(state);
    const rangeStr = globalMatch[1];
    let pattern = globalMatch[2];

    // Simplified regex handling: assume input is mostly compatible with JS regex
    // but handle common Vim-specific escapes if needed.
    // The test uses \| for alternation, which is Vim style. JS uses |.
    pattern = pattern.replace(/\\\|/g, "|");
    // Remove other unnecessary backslashes for standard chars
    pattern = pattern.replace(/\\([^+?()|])/g, "$1");

    try {
      const caseInsensitive =
        state.options.ignorecase &&
        (!state.options.smartcase || pattern.toLowerCase() === pattern);
      const regexFlags = caseInsensitive ? "i" : "";
      const regex = new RegExp(pattern, regexFlags);
      const { start: startLine, end: endLine } = rangeStr
        ? parseCommandRange(rangeStr, state)
        : { start: 0, end: Math.max(0, state.lines.length - 1) };

      state.lines = state.lines.filter((line: string, index: number) => {
        if (index < startLine || index > endLine) return true;
        const match = regex.test(line);
        return !match;
      });

      if (state.lines.length === 0) state.lines.push("");
      clampCursor(state);
    } catch (e) {
      console.error("Global command failed", e);
    }
    finishCommand(state);
    return state;
  }

  // Substitute command
  const subMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?s\/(.+?)(\/(.*?)(\/([gimc]*))?)?$/
  );
  if (subMatch) {
    saveUndo(state);
    let [, rangeStr, pattern, , replacement, , flags] = subMatch;
    replacement = replacement || "";
    flags = flags || "";
    const global = flags.includes("g");
    const explicitIgnore = flags.includes("i");
    const explicitNoIgnore = flags.includes("I");
    const caseInsensitive =
      explicitIgnore ||
      (!explicitNoIgnore &&
        state.options.ignorecase &&
        (!state.options.smartcase || pattern.toLowerCase() === pattern));

    let { start: startLine, end: endLine } = parseCommandRange(rangeStr, state);

    // Clamp range to existing lines to avoid undefined entries
    if (state.lines.length === 0) state.lines.push("");
    startLine = Math.max(0, startLine);
    endLine = Math.min(state.lines.length - 1, endLine);

    if (rangeStr === "'<,'>" && state.visualStart) {
      const vs = state.visualStart;
      const cur = { line: state.cursorLine, col: state.cursorCol };
      startLine = Math.min(vs.line, cur.line);
      endLine = Math.max(vs.line, cur.line);
    }

    if (pattern.startsWith("\\v")) {
      pattern = pattern.slice(2);
    } else {
      pattern = pattern
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\+/g, "+")
        .replace(/\\\?/g, "?")
        .replace(/\\\|/g, "|")
        .replace(/\\\{/g, "{")
        .replace(/\\\}/g, "}");
    }

    replacement = replacement.replace(/\\(\d)/g, "$$$1");
    replacement = replacement.replace(/(^|[^\\])&/g, "$1$$&");
    replacement = replacement.replace(/\\&/g, "&");
    replacement = replacement.replace(/\\r/g, "\n");
    replacement = replacement.replace(/\\n/g, "\n");
    replacement = replacement.replace(/\\t/g, "\t");

    const isExpression = replacement.startsWith("\\=");
    const exprBody = isExpression ? replacement.slice(2) : null;

    const originalCursorLine = state.cursorLine;
    const originalCursorCol = state.cursorCol;

    try {
      const hasNewline = pattern.includes("\\n") || pattern.includes("\n");
      const lineRegexFlags = (global ? "g" : "") + (caseInsensitive ? "i" : "");
      const multiRegexFlags =
        (global ? "g" : "") + "m" + (caseInsensitive ? "i" : "");
      const lineRegex = new RegExp(pattern, lineRegexFlags);
      const multiRegex = new RegExp(pattern, multiRegexFlags);

      if (isExpression) {
        for (let i = startLine; i <= endLine; i++) {
          const line = state.lines[i] ?? "";
          state.lines[i] = line.replace(lineRegex, () => {
            return evaluateVimExpression(exprBody || "", { line: i + 1 });
          });
        }
      } else if (hasNewline) {
        const linesSubset = state.lines.slice(startLine, endLine + 1);
        const text = linesSubset.join("\n");
        const newText = text.replace(multiRegex, replacement);
        const newLines = newText.split("\n");

        state.lines.splice(startLine, endLine - startLine + 1, ...newLines);
      } else {
        for (let i = startLine; i <= endLine; i++) {
          const line = state.lines[i] ?? "";
          state.lines[i] = line.replace(lineRegex, replacement);
        }
      }

      state.cursorLine = Math.min(originalCursorLine, state.lines.length - 1);
      const maxCol = (state.lines[state.cursorLine]?.length || 1) - 1;
      state.cursorCol = Math.max(0, Math.min(originalCursorCol, maxCol));

      clampCursor(state);
      if (state.visualStart) {
        state.mode = "normal";
        state.visualStart = null;
      }
    } catch (e) {
      console.error(`[VimEngine] Regex error:`, e);
    }
  }

  finishCommand(state);
  return state;
}
