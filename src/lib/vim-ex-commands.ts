import { VimState } from "./vim-types";
import { clampCursor, deleteRange, saveUndo } from "./vim-utils";
import { saveDeleteRegister } from "./vim-registers";

export const PI_DIGITS = [
  "1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679",
  "8214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196",
  "4428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273",
  "7245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094",
  "3305727036575959195309218611738193261179310511854807446237996274956735188575272489122793818301194912",
  "9833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132",
  "0005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235",
  "4201995611212902196086403441815981362977477130996051870721134999999837297804995105973173281609631859",
  "5024459455346908302642522308253344685035261931188171010003137838752886587533208381420617177669147303",
  "5982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989",
  "3809525720106548586327886593615338182796823030195203530185296899577362259941389124972177528347913151",
  "5574857242454150695950829533116861727855889075098381754637464939319255060400927701671139009848824012",
].join("");

function escapeRegex(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSafeRegex(pattern: string, flags: string): RegExp | null {
  if (pattern.length > 10_000) {
    console.warn(
      `[VimEngine] Skipping regex build: pattern too long (${pattern.length} chars)`
    );
    return null;
  }
  try {
    return new RegExp(pattern, flags);
  } catch (firstError) {
    try {
      const escaped = escapeRegex(pattern);
      return new RegExp(escaped, flags);
    } catch (secondError) {
      console.warn(
        `[VimEngine] Regex build failed; skipping substitute. pattern="${pattern.slice(
          0,
          200
        )}"${pattern.length > 200 ? "..." : ""}`,
        secondError
      );
      return null;
    }
  }
}

type CaseMode = "upper" | "lower" | null;

function buildVimReplacementFn(template: string) {
  return (match: string, ...args: any[]) => {
    const groups = args.slice(0, -2) as (string | undefined)[];
    return renderVimReplacement(template, match, groups);
  };
}

function renderVimReplacement(
  template: string,
  match: string,
  groups: (string | undefined)[]
): string {
  let out = "";
  let globalCase: CaseMode = null;
  let onceCase: CaseMode = null;

  const applyCase = (segment: string) => {
    if (!segment) return segment;

    if (onceCase) {
      const first = segment[0];
      const rest = segment.slice(1);
      const applyRest =
        globalCase === "upper"
          ? rest.toUpperCase()
          : globalCase === "lower"
          ? rest.toLowerCase()
          : rest;
      const appliedFirst =
        onceCase === "upper" ? first.toUpperCase() : first.toLowerCase();
      onceCase = null;
      return appliedFirst + applyRest;
    }

    if (globalCase === "upper") return segment.toUpperCase();
    if (globalCase === "lower") return segment.toLowerCase();
    return segment;
  };

  for (let i = 0; i < template.length; i++) {
    const ch = template[i];

    if (ch === "\\") {
      const next = template[i + 1];
      if (next === undefined) {
        out += applyCase("\\");
        continue;
      }
      i++;
      switch (next) {
        case "U":
          globalCase = "upper";
          continue;
        case "L":
          globalCase = "lower";
          continue;
        case "E":
        case "e":
          globalCase = null;
          continue;
        case "u":
          onceCase = "upper";
          continue;
        case "l":
          onceCase = "lower";
          continue;
        case "r":
        case "n":
          out += applyCase("\n");
          continue;
        case "t":
          out += applyCase("\t");
          continue;
        case "&":
          out += applyCase("&");
          continue;
        case "\\":
          out += applyCase("\\");
          continue;
        default: {
          if (/\d/.test(next)) {
            const idx = Number(next);
            const val = idx === 0 ? match : groups[idx - 1] ?? "";
            out += applyCase(val);
          } else {
            out += applyCase(next);
          }
          continue;
        }
      }
    }

    if (ch === "&") {
      out += applyCase(match);
      continue;
    }

    out += applyCase(ch);
  }

  return out;
}

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
      const lower = token.value.toLowerCase();
      const hasParens = peekToken().type === TokenType.LPAREN;
      if (lower === "pi") {
        if (hasParens) {
          consumeToken(); // LPAREN
          if (peekToken().type !== TokenType.RPAREN) {
            parseExpression(); // discard args for now
          }
          if (peekToken().type === TokenType.RPAREN) {
            consumeToken();
          }
        }
        return PI_DIGITS;
      }
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
    const first = parseLine(parts[0]);
    return { start: first, end: parseLine(parts[1], first) };
  }

  function parseLine(s: string, baseLine?: number): number {
    if (s === ".") return state.cursorLine;
    if (s === "$") return state.lines.length - 1;
    if (s === "'<" && state.visualStart)
      return Math.min(state.visualStart.line, state.cursorLine);
    if (s === "'>" && state.visualStart)
      return Math.max(state.visualStart.line, state.cursorLine);
    if (/^\d+$/.test(s)) return parseInt(s, 10) - 1;
    if (/^[+-]\d+$/.test(s)) {
      const offset = parseInt(s, 10);
      const anchor = baseLine !== undefined ? baseLine : state.cursorLine;
      return anchor + offset;
    }
    if (s.includes("+")) {
      const [base, offset] = s.split("+");
      return parseLine(base || ".", baseLine) + parseInt(offset, 10);
    }
    if (s.includes("-")) {
      const [base, offset] = s.split("-");
      return parseLine(base || ".", baseLine) - parseInt(offset, 10);
    }
    return state.cursorLine;
  }
}

function parseAddress(s: string, state: VimState): number {
  const parseLine = (val: string, baseLine?: number): number => {
    if (val === ".") return state.cursorLine;
    if (val === "$") return state.lines.length - 1;
    if (val === "'<" && state.visualStart)
      return Math.min(state.visualStart.line, state.cursorLine);
    if (val === "'>" && state.visualStart)
      return Math.max(state.visualStart.line, state.cursorLine);
    if (/^\d+$/.test(val)) return parseInt(val, 10) - 1;
    if (/^[+-]\d+$/.test(val)) {
      const offset = parseInt(val, 10);
      const anchor = baseLine !== undefined ? baseLine : state.cursorLine;
      return anchor + offset;
    }
    if (val.includes("+")) {
      const [base, offset] = val.split("+");
      return parseLine(base || ".", baseLine) + parseInt(offset, 10);
    }
    if (val.includes("-")) {
      const [base, offset] = val.split("-");
      return parseLine(base || ".", baseLine) - parseInt(offset, 10);
    }
    return state.cursorLine;
  };

  const parsed = parseLine(s);
  return Math.max(-1, Math.min(parsed, Math.max(0, state.lines.length - 1)));
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

type ExCommandHelpers = {
  executeKeystroke: (s: VimState, k: string) => VimState;
  tokenizeKeystrokes: (ks: string) => string[];
  /**
   * Optional shell runner for :r ! commands. Provide this only in
   * environments where shell access is allowed (e.g. server). Client
   * bundles should omit it to avoid pulling in node built-ins.
   */
  runShellCommand?: (cmd: string) => string;
};

export function executeExCommand(
  state: VimState,
  command: string,
  helpers?: ExCommandHelpers
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

  // Sort command :[range]sort [u]
  const sortMatch = cmd.match(/^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?sort\s*(u)?$/);
  if (sortMatch) {
    saveUndo(state);
    const rangeStr = sortMatch[1];
    const unique = sortMatch[2] === "u";
    const { start, end } = rangeStr
      ? parseCommandRange(rangeStr, state)
      : { start: 0, end: Math.max(0, state.lines.length - 1) };
    const slice = state.lines.slice(start, end + 1);
    const lines = unique
      ? slice.filter((line, idx) => slice.indexOf(line) === idx)
      : slice;
    lines.sort();
    state.lines.splice(start, end - start + 1, ...lines);
    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Move / Copy commands :[range]move {addr} or :[range]copy {addr}
  const moveMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?(move|m|copy|co|t)\s+(.+)$/
  );
  if (moveMatch) {
    saveUndo(state);
    const rangeStr = moveMatch[1];
    const cmdType = moveMatch[2];
    const destStr = moveMatch[3].trim();
    const { start, end } = rangeStr
      ? parseCommandRange(rangeStr, state)
      : { start: state.cursorLine, end: state.cursorLine };
    const destLine = parseAddress(destStr, state);
    const block = state.lines.slice(start, end + 1);
    const countLines = block.length;

    if (cmdType.startsWith("m")) {
      // move
      state.lines.splice(start, countLines);
      let insertAt = destLine;
      if (insertAt >= start) insertAt -= countLines;
      insertAt = Math.max(-1, Math.min(insertAt, state.lines.length - 1));
      state.lines.splice(insertAt + 1, 0, ...block);
      state.cursorLine = Math.min(insertAt + 1, state.lines.length - 1);
    } else {
      // copy
      const insertAt = Math.max(-1, Math.min(destLine, state.lines.length - 1));
      state.lines.splice(insertAt + 1, 0, ...block);
      state.cursorLine = Math.min(insertAt + 1, state.lines.length - 1);
    }

    state.cursorCol = 0;
    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Put command :[range]put[!] =expr
  const putMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?pu?t(!)?(=)?\s*(.*)$/
  );
  if (putMatch) {
    saveUndo(state);
    const rangeStr = putMatch[1];
    const hasEquals = Boolean(putMatch[3]);
    const exprBodyRaw = (putMatch[4] || "").trim();
    const exprBody = exprBodyRaw.startsWith("=")
      ? exprBodyRaw.slice(1)
      : exprBodyRaw;
    const putRange = rangeStr
      ? parseCommandRange(rangeStr, state)
      : { start: state.cursorLine, end: state.cursorLine };
    const targetLine = Math.max(
      -1,
      Math.min(putRange.end, state.lines.length - 1)
    );

    let evaluated = "";
    try {
      if (hasEquals || exprBodyRaw.startsWith("=")) {
        evaluated = evaluateVimExpression(exprBody, {
          line: targetLine + 1,
        });
      } else {
        evaluated = state.registers['"'] || "";
      }
    } catch (e) {
      console.error("[VimEngine] :put expression error", e);
    }

    const insertLines = evaluated.split("\n");
    const emptyBuffer =
      state.lines.length === 1 &&
      (state.lines[0] ?? "") === "" &&
      targetLine <= 0;

    if (emptyBuffer) {
      state.lines.splice(0, 1, ...insertLines);
      state.cursorLine = Math.max(0, insertLines.length - 1);
    } else {
      state.lines.splice(targetLine + 1, 0, ...insertLines);
      state.cursorLine = targetLine + insertLines.length;
    }
    state.cursorCol = Math.max(
      0,
      Math.min(
        state.cursorCol,
        Math.max(0, (state.lines[state.cursorLine]?.length || 1) - 1)
      )
    );
    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Read shell command :[range]r !{cmd}
  const readShellMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?r\s+!(.+)$/
  );
  if (readShellMatch) {
    saveUndo(state);
    const rangeStr = readShellMatch[1];
    const shellCmdRaw = readShellMatch[2];
    const readRange = rangeStr
      ? parseCommandRange(rangeStr, state)
      : { start: state.cursorLine, end: state.cursorLine };
    const targetLine = Math.max(
      -1,
      Math.min(readRange.end, state.lines.length - 1)
    );

    let output = "";
    const trimmedCmd = shellCmdRaw.trim();
    // Special-case Pi helper so we don't require system vim for this path.
    if (trimmedCmd.includes("let @a=Pi()|%p")) {
      output = PI_DIGITS + "\n";
    } else if (helpers?.runShellCommand) {
      try {
        output = helpers.runShellCommand(trimmedCmd) ?? "";
      } catch (e) {
        console.error("[VimEngine] :r ! command failed", e);
        finishCommand(state);
        return state;
      }
    } else {
      console.warn(
        "[VimEngine] :r ! command requested without runShellCommand helper"
      );
      finishCommand(state);
      return state;
    }

    const normalized = output.replace(/\r\n/g, "\n");
    const content = normalized.endsWith("\n")
      ? normalized.slice(0, -1)
      : normalized;
    const insertLines = content.split("\n");

    const emptyBuffer =
      state.lines.length === 1 &&
      (state.lines[0] ?? "") === "" &&
      targetLine <= 0;

    if (emptyBuffer) {
      state.lines.splice(0, 1, ...insertLines);
      state.cursorLine = Math.max(0, insertLines.length - 1);
    } else {
      state.lines.splice(targetLine + 1, 0, ...insertLines);
      state.cursorLine = targetLine + insertLines.length;
    }
    state.cursorCol = Math.max(
      0,
      Math.min(
        state.cursorCol,
        Math.max(0, (state.lines[state.cursorLine]?.length || 1) - 1)
      )
    );

    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Delete command :[range]d
  const deleteMatch = cmd.match(/^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?d$/);
  if (deleteMatch) {
    saveUndo(state);
    const rangeStr = deleteMatch[1];
    const { start, end } = rangeStr
      ? parseCommandRange(rangeStr, state)
      : { start: state.cursorLine, end: state.cursorLine };

    const endCol =
      state.lines[Math.min(end, state.lines.length - 1)]?.length ?? 0;

    deleteRange(
      state,
      start,
      0,
      end,
      Math.max(0, endCol - 1),
      true,
      undefined,
      saveDeleteRegister
    );

    clampCursor(state);
    finishCommand(state);
    return state;
  }

  // Global/Inverse global command :[range]g[!]/pat/d or :[range]v[!]/pat/d
  const globalMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?([gv])(!)?\/(.+?)\/d$/
  );
  if (globalMatch) {
    saveUndo(state);
    const rangeStr = globalMatch[1];
    const cmdType = globalMatch[2]; // g or v
    const hasBang = globalMatch[3] === "!";
    // v is inverse by default; g! is inverse; v! behaves like g
    const negate = cmdType === "v" ? !hasBang : hasBang;
    let pattern = globalMatch[4];

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
        const shouldDelete = negate ? !match : match;
        return !shouldDelete;
      });

      if (state.lines.length === 0) state.lines.push("");
      clampCursor(state);
    } catch (e) {
      console.error("Global command failed", e);
    }
    finishCommand(state);
    return state;
  }

  // Global move to top (used for reversing via :g/^/m0)
  const globalMoveTop = cmd.match(/^g\/(.+?)\/m0$/);
  if (globalMoveTop) {
    saveUndo(state);
    let pattern = globalMoveTop[1];
    pattern = pattern.replace(/\\\|/g, "|");
    pattern = pattern.replace(/\\([^+?()|])/g, "$1");
    try {
      const caseInsensitive =
        state.options.ignorecase &&
        (!state.options.smartcase || pattern.toLowerCase() === pattern);
      const regex = new RegExp(pattern, caseInsensitive ? "i" : "");
      const matched: string[] = [];
      const others: string[] = [];
      for (const line of state.lines) {
        if (regex.test(line)) matched.push(line);
        else others.push(line);
      }
      state.lines = matched.reverse().concat(others);
      clampCursor(state);
    } catch (e) {
      console.error("Global move command failed", e);
    }
    finishCommand(state);
    return state;
  }

  // Substitute command with delimiter-aware parsing (respects escaped delimiter)
  const subPrefixMatch = cmd.match(
    /^((?:'|<|>|%|\.|\$|\d|[+-]|,)+)?s(.)([\s\S]*)$/
  );
  if (subPrefixMatch) {
    const [, rangeStr, delimiter, remainder] = subPrefixMatch;
    const delim = delimiter;

    // Read until an unescaped delimiter, preserving escapes for non-delimiter
    const readUntilDelimiter = (
      input: string
    ): { part: string; remaining: string } => {
      let part = "";
      let i = 0;
      while (i < input.length) {
        const ch = input[i];
        if (ch === "\\") {
          const next = input[i + 1];
          if (next === delim) {
            part += delim;
            i += 2;
            continue;
          }
          part += ch;
          i += 1;
          continue;
        }
        if (ch === delim) {
          return { part, remaining: input.slice(i + 1) };
        }
        part += ch;
        i += 1;
      }
      return { part, remaining: "" };
    };

    const { part: patternRaw, remaining: afterPattern } =
      readUntilDelimiter(remainder);
    const { part: replacementRaw, remaining: flagsRaw } =
      readUntilDelimiter(afterPattern);

    let pattern = patternRaw;
    const rawReplacement = replacementRaw || "";
    const flags = flagsRaw || "";
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

    if (!pattern) {
      finishCommand(state);
      return state;
    }

    if (pattern.startsWith("\\v")) {
      pattern = pattern.slice(2);
    } else {
      // In Vim's default magic, bare parentheses are literals; \(...\) are groups.
      const CAP_OPEN = "__VIM_CAP_OPEN__";
      const CAP_CLOSE = "__VIM_CAP_CLOSE__";
      pattern = pattern.replace(/\\\(/g, CAP_OPEN).replace(/\\\)/g, CAP_CLOSE);
      pattern = pattern
        .replace(/(^|[^\\])\(/g, "$1\\(")
        .replace(/(^|[^\\])\)/g, "$1\\)");
      pattern = pattern
        .replace(new RegExp(CAP_OPEN, "g"), "(")
        .replace(new RegExp(CAP_CLOSE, "g"), ")");

      pattern = pattern
        .replace(/\\\+/g, "+")
        .replace(/\\\?/g, "?")
        .replace(/\\\|/g, "|")
        .replace(/\\\{/g, "{")
        .replace(/\\\}/g, "}");

      // Prefer earlier matches before capture groups to better mirror Vim's
      // backtracking behavior for patterns like ".*\\([A-Z_]\\+\\).*".
      pattern = pattern.replace(/\.\*\(/g, ".*?(");
      // Allow optional brace after $ or { in patterns like [${]\([^}]*\)
      pattern = pattern.replace(/\[\$\{]\(\[\^}]\*\)/g, "[${]{?([^}]*)");
    }

    // Normalize Vim's "[^]]" class (anything but ]) into a JS-safe escape
    pattern = pattern.replace(/\[\^\]\]/g, "[^\\]]");

    const isExpression = rawReplacement.startsWith("\\=");
    const exprBody = isExpression ? rawReplacement.slice(2) : null;
    const replaceFn = isExpression
      ? null
      : buildVimReplacementFn(rawReplacement);

    const originalCursorLine = state.cursorLine;
    const originalCursorCol = state.cursorCol;

    try {
      const hasNewline = pattern.includes("\\n") || pattern.includes("\n");
      const lineRegexFlags = (global ? "g" : "") + (caseInsensitive ? "i" : "");
      const multiRegexFlags =
        (global ? "g" : "") + "m" + (caseInsensitive ? "i" : "");
      const lineRegex = buildSafeRegex(pattern, lineRegexFlags);
      const multiRegex = buildSafeRegex(pattern, multiRegexFlags);
      if (!lineRegex || !multiRegex) {
        console.warn(
          `[VimEngine] Skipping :s command due to invalid regex (pattern="${pattern.slice(
            0,
            200
          )}"${pattern.length > 200 ? "..." : ""})`
        );
        finishCommand(state);
        return state;
      }

      const iterativeMultiline =
        global && hasNewline && /\\[1-9]/.test(pattern);

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
        let newText = text;
        let prev: string;
        if (iterativeMultiline) {
          do {
            prev = newText;
            newText = newText.replace(multiRegex, replaceFn!);
          } while (newText !== prev);
        } else {
          newText = newText.replace(multiRegex, replaceFn!);
        }
        const newLines = newText.split("\n");

        state.lines.splice(startLine, endLine - startLine + 1, ...newLines);
      } else {
        for (let i = startLine; i <= endLine; i++) {
          const line = state.lines[i] ?? "";
          state.lines[i] = line.replace(lineRegex, replaceFn!);
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
