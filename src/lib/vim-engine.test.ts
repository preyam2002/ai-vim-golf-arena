import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  countKeystrokes,
  extractKeystroke,
  type VimState,
} from "./vim-engine";

function runTest(
  initialText: string,
  keystrokes: string,
  expectedText: string,
  initialState?: Partial<VimState>,
  tokensOverride?: string[]
) {
  let state = createInitialState(initialText);
  if (initialState) {
    state = { ...state, ...initialState };
  }
  const tokens = tokensOverride ?? tokenizeKeystrokes(keystrokes);
  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }
  expect(state.lines.join("\n")).toBe(expectedText);
}

describe("vim-engine", () => {
  test("Redo", () => runTest("hello", "x<Esc>u<C-r>", "ello"));
  test("Replace", () => runTest("hello", "rX", "Xello"));
  test("Basic Delete (dw)", () => runTest("hello world", "dw", "world"));
  test("Paragraph Delete", () => runTest("a\n\nb", "d}", "\nb"));
  test("Backspace (X)", () => runTest("hello", "lX", "ello"));
  test("Toggle Case (~)", () => runTest("a", "~", "A"));
  test("Uppercase to end of file (gUG)", () =>
    runTest("one\ntwo\nthree", "jgUG", "one\nTWO\nTHREE"));
  test("Visual Block Entry", () => runTest("abc", "<C-v><Esc>", "abc"));
  test("Visual Block Delete", () =>
    runTest("aaa\nbbb\nccc", "<C-v>jjlx", "a\nb\nc"));
  test("Visual Block Append (;)", () =>
    runTest(
      "let x = 1\nlet y = 2\nlet z = 3",
      "<C-v>G$A;<Esc>",
      "let x = 1;\nlet y = 2;\nlet z = 3;"
    ));
  test("Visual Block Number Increment (g<C-a>)", () =>
    runTest(
      "apple\nbanana\ncherry",
      "<C-v>GI1. <Esc>gg0<C-v>Gg<C-a>",
      "1. apple\n2. banana\n3. cherry"
    ));
  test("Substitute append semicolons", () =>
    runTest(
      "let x = 1\nlet y = 2\nlet z = 3",
      ":%s/$/;/<CR>",
      "let x = 1;\nlet y = 2;\nlet z = 3;"
    ));
  test("Global delete blank lines", () =>
    runTest("a\n\nb\n\nc", ":g/^$/d<CR>", "a\nb\nc"));
  test("Collapse and clean blank lines workflow", () =>
    runTest(
      "line1\n\n\n\nline2\n\n\n\nline3",
      ":g/^$/d<CR>",
      "line1\nline2\nline3"
    ));
  test("Search Word (*)", () =>
    runTest("foo bar foo", "*cwX<Esc>", "foo bar X"));

  test("ignorecase search", () => {
    let caseState = createInitialState("Foo\nbar");
    caseState = executeKeystroke(caseState, "/foo<CR>");
    expect([caseState.cursorLine, caseState.cursorCol]).toEqual([0, 0]);
  });

  test("smartcase search", () => {
    let smartState = createInitialState("foo\nFoo");
    smartState = executeKeystroke(smartState, "/Foo<CR>");
    expect([smartState.cursorLine, smartState.cursorCol]).toEqual([1, 0]);
  });

  test("Tag Object (cit)", () =>
    runTest("<div>content</div>", "cit<Esc>", "<div></div>", {
      cursorLine: 0,
      cursorCol: 5,
    }));

  test("Nested Tag Object (cit)", () =>
    runTest(
      "<div><b>bold</b><i>italic</i></div>",
      "cit<Esc>",
      "<div><b>bold</b><i></i></div>",
      { cursorLine: 0, cursorCol: 18 }
    ));

  test("Nested Tag Object (between tags)", () =>
    runTest(
      "<div><b>bold</b> text <i>italic</i></div>",
      "cit<Esc>",
      "<div></div>",
      { cursorLine: 0, cursorCol: 15 }
    ));

  test("Registers (explicit state)", () =>
    runTest("world", '"aywdd"aP', "world", {
      lines: ["world"],
      cursorLine: 0,
      cursorCol: 0,
    }));

  test("Registers (yank/paste)", () => runTest("hello", '"aywdd"aP', "hello"));

  test("Repeat (.)", () => runTest("hello world", "dw.", ""));

  test("Macros", () => runTest("a\nb\nc", "qaI-<Esc>jq@a", "-a\n-b\nc"));

  test("Expression Substitution", () =>
    runTest("a\nb\nc", ":%s/^/\\=line('.') . '. '/<CR>", "1. a\n2. b\n3. c"));

  test("Strict Expression Substitution", () =>
    runTest(
      "apple\nbanana\ncherry",
      ":%s/^/\\=v:lnum.'. '/<CR>",
      "1. apple\n2. banana\n3. cherry"
    ));

  test("Expression Substitution with subtraction", () =>
    runTest(
      "alpha\nbeta",
      ":%s/^/\\=line('.')-1 . '. '/<CR>",
      "0. alpha\n1. beta"
    ));

  test("Expression with Whitespace", () =>
    runTest("a\nb", ":%s/^/\\=line( '.' ) . '. '/<CR>", "1. a\n2. b"));

  test("Expression with Double Quotes", () =>
    runTest("a\nb", ':%s/^/\\=line(".").". "/<CR>', "1. a\n2. b"));

  test("Normal range with expression register", () =>
    runTest(
      "a\nb\nc",
      ":%norm I<C-R>=line('.')<CR>. <Esc><CR>",
      "1. a\n2. b\n3. c",
      undefined,
      [":%norm I<C-R>=line('.')<CR>. <Esc><CR>"]
    ));

  describe("static challenge solutions", () => {
    test("Simple Addition", () =>
      runTest(
        "apple\nbanana\ncherry",
        ":%s/^/\\=line('.') . '. '/<CR>",
        "1. apple\n2. banana\n3. cherry"
      ));

    test("Swap Words", () =>
      runTest(
        "hello world\nfoo bar\nping pong",
        ":%s/\\(\\S\\+\\) \\(\\S\\+\\)/\\2 \\1/<CR>",
        "world hello\nbar foo\npong ping"
      ));

    test("Remove Duplicates", () =>
      runTest(
        "one\ntwo\ntwo\nthree\nthree\nthree",
        ":%s/\\v^(.*)\\n\\1/\\1/g<CR>",
        "one\ntwo\nthree"
      ));

    test("Uppercase Conversion", () =>
      runTest(
        "hello world\nthis is vim golf",
        "gggUG",
        "HELLO WORLD\nTHIS IS VIM GOLF"
      ));

    test("Add Quotes", () =>
      runTest(
        "apple banana cherry",
        ':%s/\\S\\+/"&"/g<CR>',
        '"apple" "banana" "cherry"'
      ));

    test("Reverse Lines", () =>
      runTest(
        "first\nsecond\nthird\nfourth",
        ":g/^/m0<CR>",
        "fourth\nthird\nsecond\nfirst"
      ));

    test("Delete Empty Lines", () =>
      runTest(
        "line1\n\nline2\n\n\nline3",
        ":g/^$/d<CR>",
        "line1\nline2\nline3"
      ));

    test("Add Semicolons", () =>
      runTest(
        "let x = 1\nlet y = 2\nlet z = 3",
        ":%s/$/;/<CR>",
        "let x = 1;\nlet y = 2;\nlet z = 3;"
      ));

    test("Trim Spaces", () =>
      runTest(
        "alpha  \nbeta   \ngamma    \ndelta",
        ":%s/\\s\\+$//<CR>",
        "alpha\nbeta\ngamma\ndelta"
      ));

    test("Join Lines", () =>
      runTest(
        "red\ngreen\nblue\nyellow",
        ":%s/\\n/, /g<CR>",
        "red, green, blue, yellow"
      ));

    test("YAML to dotenv", () =>
      runTest(
        "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n",
        ":g!/ENV/d<CR>:%s/.*!ENV.*\\([A-Z_]\\+\\).*/\\1=/g<CR>",
        "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC="
      ));

    test("YAML to dotenv (multi-step)", () =>
      runTest(
        "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n",
        ":%s/.*{\\(.*\\)}.*/\\1=/g<CR>ggdj:%s/.*: //<CR>:%s/^vimgolf.*\\n//<CR>:%s/ \\w.*\\n//g<CR>:%s/\\n\\n\\+/\\r<CR>:g/^[^=]*$/d<CR>:%s/^\\s\\+//g<CR>G$a<CR><Esc>kJx",
        "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC="
      ));

    test("YAML to dotenv (inverse global)", () =>
      runTest(
        "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n",
        ":v/!ENV/d<CR>:%s/.*!ENV\\s*[${]\\([^}]*\\).*/\\1=/<CR>",
        "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC="
      ));

    test("YAML to dotenv (raw multi-step)", () =>
      runTest(
        "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n",
        ":%s/.*{\\(.*\\)}.*/\\1=/g<CR>ggdj:%s/.*: //<CR>:%s/^vimgolf.*\\n//<CR>:%s/ \\w.*\\n//g<CR>:%s/\\n\\n\\+/\\r<CR>G$a<CR><Esc>kJx",
        "INFO\napp:\n POSTGRES_HOST=\nPOSTGRES_PORT=\n PULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC=\n"
      ));
  });

  test("countKeystrokes utility", () => {
    const countTest = ":%s/^/\\=line('.').'. '/<CR>";
    expect(countKeystrokes(countTest)).toBe(24);
  });

  test("Incremental Command Execution", () => {
    let incState = createInitialState("foo");
    incState = executeKeystroke(incState, ":");
    expect(incState.commandLine).toBe("");
    incState = executeKeystroke(incState, "s");
    expect(incState.commandLine).toBe("s");
    incState = executeKeystroke(incState, "/");
    expect(incState.commandLine).toBe("s/");
    incState = executeKeystroke(incState, "<BS>");
    expect(incState.commandLine).toBe("s");
    const tokens = tokenizeKeystrokes("/bar/r<CR>");
    for (const t of tokens) {
      incState = executeKeystroke(incState, t);
    }
    expect(incState.lines[0]).toBe("foo");
    expect(incState.commandLine).toBeNull();
  });

  test("Partial Ex Command", () => {
    let partialState = createInitialState("foo");
    partialState = executeKeystroke(partialState, ":");
    partialState = executeKeystroke(partialState, "%");
    expect(partialState.commandLine).toBe("%");
    partialState = executeKeystroke(partialState, "s");
    expect(partialState.commandLine).toBe("%s");
  });

  test("Extract Keystroke with Ex chars", () => {
    const ex1 = extractKeystroke(":%s", "normal");
    expect(ex1).toBe(":");
    const ex2 = extractKeystroke("%s", "normal");
    expect(ex2).toBe("%");
    const ex3 = extractKeystroke("s", "normal");
    expect(ex3).toBe("s");
  });

  test("Visual find lands on target character", () => {
    let state = createInitialState("abcde");
    state = executeKeystroke(state, "v");
    state = executeKeystroke(state, "f");
    state = executeKeystroke(state, "e");
    expect(state.cursorCol).toBe(4);
    expect(state.mode).toBe("visual");
    expect(state.visualStart?.col).toBe(0);
  });

  test("Charwise paste keeps blank lines in register", () => {
    let state = createInitialState("x");
    state.registers['"'] = "line1\n\nline2";
    state.registerMetadata['"'] = { isLinewise: false };
    state = executeKeystroke(state, "p");
    expect(state.lines.join("\n")).toBe("xline1\n\nline2");
  });

  test("Visual block delete stores deleted text in default register", () => {
    let state = createInitialState("ab\nAB");
    state.cursorCol = 1;
    state = executeKeystroke(state, "<C-v>");
    state = executeKeystroke(state, "j");
    state = executeKeystroke(state, "x");
    expect(state.lines.join("\n")).toBe("a\nA");
    expect(state.registers['"']).toBe("b\nB");
  });

  test("Replace mode (R) overwrites characters", () => {
    let state = createInitialState("hello");
    const tokens = tokenizeKeystrokes("RXY<Esc>");
    for (const t of tokens) state = executeKeystroke(state, t);
    expect(state.lines.join("\n")).toBe("XYllo");
    expect(state.mode).toBe("normal");
  });

  test("Visual exit returns cursor to selection start col", () => {
    let state = createInitialState("hello");
    state = executeKeystroke(state, "l"); // move to e (col 1)
    state = executeKeystroke(state, "v");
    state = executeKeystroke(state, "ll"); // extend to l (col 3)
    state = executeKeystroke(state, "<Esc>");
    expect(state.cursorLine).toBe(0);
    expect(state.cursorCol).toBe(1);
    expect(state.mode).toBe("normal");
  });

  describe("random mixed sequences", () => {
    test("delete/change/append combo", () =>
      runTest("one two three", "dwA!<Esc>", "two three!"));

    test("uppercases whole buffer quickly", () =>
      runTest("mix\nCase\nhere", "gggUG", "MIX\nCASE\nHERE"));

    test("search, edit, repeat next match", () =>
      runTest("foo bar foo", "ciwX<Esc>/foo<CR>ciwY<Esc>", "X bar Y"));

    test("macro append replay across lines", () =>
      runTest("one\ntwo\nthree", "qaA!<Esc>qj@aj@a", "one!\ntwo!\nthree!"));
  });

  describe("randomized fuzz sequences", () => {
    const modes = ["normal", "insert", "visual", "visual-line", "visual-block", "replace", "commandline"];

    function seededRand(seed: number) {
      let x = seed | 0;
      return () => {
        // xorshift32
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return ((x >>> 0) % 1_000_000) / 1_000_000;
      };
    }

    const tokenPool = [
      "h",
      "j",
      "k",
      "l",
      "w",
      "b",
      "e",
      "0",
      "$",
      "x",
      "i",
      "a",
      "A",
      "o",
      "O",
      "v",
      "V",
      "<Esc>",
      "dd",
      "yy",
      "p",
      "P",
      "dw",
      "ciw",
      "gUiw",
    ];

    const startPool = [
      "alpha beta gamma",
      "line1\nline2\nline3",
      "foo bar baz\nqux quux",
      "one",
      "a b c d e",
    ];

    function assertStateInvariant(state: VimState) {
      expect(state.lines.length).toBeGreaterThan(0);
      expect(state.cursorLine).toBeGreaterThanOrEqual(0);
      expect(state.cursorLine).toBeLessThan(state.lines.length);
      const lineLen = state.lines[state.cursorLine]?.length ?? 0;
      const maxCol = state.mode === "insert" ? lineLen : Math.max(0, lineLen - 1);
      expect(state.cursorCol).toBeGreaterThanOrEqual(0);
      expect(state.cursorCol).toBeLessThanOrEqual(maxCol);
      expect(modes.includes(state.mode)).toBe(true);
      for (const line of state.lines) {
        expect(typeof line).toBe("string");
      }
    }

    test("fuzz 30-step sequences (seeded)", () => {
      const rand = seededRand(42);
      const sequences = 10;
      const steps = 30;

      for (let s = 0; s < sequences; s++) {
        let state = createInitialState(startPool[s % startPool.length]);
        for (let i = 0; i < steps; i++) {
          const token = tokenPool[Math.floor(rand() * tokenPool.length)];
          state = executeKeystroke(state, token);
          assertStateInvariant(state);
        }
        // Ensure resulting text is a string joinable
        expect(typeof state.lines.join("\n")).toBe("string");
      }
    });
  });

  describe("deterministic mixed sequences", () => {
    test("swap two chars with xp", () => runTest("ab", "xp", "ba"));

    test("dot repeat change word", () =>
      runTest("foo bar baz", "wciwZZZ<Esc>.", "foo ZZZ baz"));

    test("uppercase word with gUw", () => runTest("hello there", "gUw", "HELLO There"));

    test("delete paragraph with dap", () =>
      runTest("one\n\nTwo\nThree", "dap", "\nTwo\nThree"));

    test("paste yanked line above with P", () =>
      runTest("first\nsecond", "yyP", "first\nfirst\nsecond"));

    test("counted increment with <C-a>", () => runTest("x1", "5<C-a>", "x2"));

    test("visual change selection", () => runTest("abcde", "vllcX<Esc>", "Xde"));

    test("I honors indentation", () => runTest("  hi", "IY<Esc>", "  Yhi"));

    test("replace char with r", () => runTest("abc", "lrZ", "aZc"));

    test("indent line with >>", () => runTest("a\nb", "j>>", "a\n  b"));

    test("append then repeat on next line", () => runTest("a\nb", "A1<Esc>j.", "a1\nb1"));

    test("delete line then paste below", () => runTest("one\ntwo", "ddp", "two\none"));
  });
});
