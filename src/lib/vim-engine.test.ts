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
      ":%s/\\n\\n/\\r/g<CR>jddj3dd$pj$pjdd:g/^$/d<CR>",
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
});
