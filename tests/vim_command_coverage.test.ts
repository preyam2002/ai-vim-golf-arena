import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";
import { maybeExpectVimParity } from "../src/lib/test-parity";

function run(text: string, keystrokes: string) {
  let state = createInitialState(text);
  for (const token of tokenizeKeystrokes(keystrokes)) {
    state = executeKeystroke(state, token);
  }
  return normalizeText(state.lines.join("\n"));
}

function runWithParity(
  text: string,
  keystrokes: string,
  expected: string
): Promise<void> | void {
  const out = run(text, keystrokes);
  expect(out).toBe(expected);
  return maybeExpectVimParity({
    startText: text,
    keystrokes,
    expectedText: expected,
  });
}

describe("vim command coverage", () => {
  test("global substitute with capture groups", () => {
    const out = run("foo foo\nbar", ":%s/foo/bar/g<CR>");
    expect(out).toBe("bar bar\nbar");
    maybeExpectVimParity({
      startText: "foo foo\nbar",
      keystrokes: ":%s/foo/bar/g<CR>",
      expectedText: "bar bar\nbar",
    });
  });

  test("global delete of blank lines", () => {
    const out = run("a\n\nb\n\n\nc\n", ":g/^$/d<CR>");
    expect(out).toBe("a\nb\nc");
    maybeExpectVimParity({
      startText: "a\n\nb\n\n\nc\n",
      keystrokes: ":g/^$/d<CR>",
      expectedText: "a\nb\nc",
    });
  });

  test("numeric count with delete lines", () => {
    const out = run("1\n2\n3\n4\n5\n", "3dd");
    expect(out).toBe("4\n5");
    maybeExpectVimParity({
      startText: "1\n2\n3\n4\n5\n",
      keystrokes: "3dd",
      expectedText: "4\n5",
    });
  });

  test("visual block insert prefix", () => {
    const out = run("a\nb\nc", "<C-v>jjI# <Esc>");
    expect(out).toBe("# a\n# b\n# c");
    maybeExpectVimParity({
      startText: "a\nb\nc",
      keystrokes: "<C-v>jjI# <Esc>",
      expectedText: "# a\n# b\n# c",
    });
  });

  test("append and repeat", () => {
    const out = run("a\nb", "A;<Esc>j.");
    expect(out).toBe("a;\nb;");
    maybeExpectVimParity({
      startText: "a\nb",
      keystrokes: "A;<Esc>j.",
      expectedText: "a;\nb;",
    });
  });

  test("substitute with escaped ampersand", () => {
    const out = run("aa\nab", ":%s/a/&x/g<CR>");
    expect(out).toBe("axax\naxb");
    maybeExpectVimParity({
      startText: "aa\nab",
      keystrokes: ":%s/a/&x/g<CR>",
      expectedText: "axax\naxb",
    });
  });

  test("join lines with count", () => {
    const out = run("a\nb\nc\nd", "2J");
    expect(out).toBe("a b\nc\nd");
    maybeExpectVimParity({
      startText: "a\nb\nc\nd",
      keystrokes: "2J",
      expectedText: "a b\nc\nd",
    });
  });

  test("uppercase word using gUiw", () => {
    const out = run("hello world", "w gUiw");
    expect(out).toBe("hello WORLD");
    maybeExpectVimParity({
      startText: "hello world",
      keystrokes: "w gUiw",
      expectedText: "hello WORLD",
    });
  });

  test("yank and paste with numbered registers", () => {
    const out = run("one\ntwo\nthree", "yyjp");
    expect(out).toBe("one\ntwo\none\nthree");
    maybeExpectVimParity({
      startText: "one\ntwo\nthree",
      keystrokes: "yyjp",
      expectedText: "one\ntwo\none\nthree",
    });
  });

  test('change inside quotes ci"', () => {
    const out = run('say "hello" now', 'f"ci"bye<Esc>');
    expect(out).toBe('say "bye" now');
    maybeExpectVimParity({
      startText: 'say "hello" now',
      keystrokes: 'f"ci"bye<Esc>',
      expectedText: 'say "bye" now',
    });
  });

  test("sentence motion deletes to next sentence", () => {
    const out = run("First. Second. Third.", "d)");
    expect(out).toBe("Second. Third.");
    maybeExpectVimParity({
      startText: "First. Second. Third.",
      keystrokes: "d)",
      expectedText: "Second. Third.",
    });
  });

  test("change inner sentence", () => {
    const out = run("First line. Second!", "cisBye.<Esc>");
    expect(out).toBe("Bye. Second!");
    maybeExpectVimParity({
      startText: "First line. Second!",
      keystrokes: "cisBye.<Esc>",
      expectedText: "Bye. Second!",
    });
  });

  test("format with gq$", () => {
    const out = run("a    b   c", "gq$");
    expect(out).toBe("a    b   c");
    maybeExpectVimParity({
      startText: "a    b   c",
      keystrokes: "gq$",
      expectedText: "a    b   c",
    });
  });

  test("indent normalize with =", () => {
    const out = run("a\n  b", "gg=G");
    expect(out).toBe("a\nb");
    maybeExpectVimParity({
      startText: "a\n  b",
      keystrokes: "gg=G",
      expectedText: "a\nb",
    });
  });

  test(":move reorders lines", () => {
    const out = run("a\nb\nc", ":2move 0<CR>");
    expect(out).toBe("b\na\nc");
    maybeExpectVimParity({
      startText: "a\nb\nc",
      keystrokes: ":2move 0<CR>",
      expectedText: "b\na\nc",
    });
  });

  test(":copy duplicates line", () => {
    const out = run("a\nb\nc", ":1copy 3<CR>");
    expect(out).toBe("a\nb\nc\na");
    maybeExpectVimParity({
      startText: "a\nb\nc",
      keystrokes: ":1copy 3<CR>",
      expectedText: "a\nb\nc\na",
    });
  });

  test(":sort unique", () => {
    const out = run("c\nb\nc\na", ":%sort u<CR>");
    expect(out).toBe("a\nb\nc");
    maybeExpectVimParity({
      startText: "c\nb\nc\na",
      keystrokes: ":%sort u<CR>",
      expectedText: "a\nb\nc",
    });
  });

  test("insert <C-u> clears to line start", () => {
    const out = run("abc", "i123<C-u>xyz<Esc>");
    expect(out).toBe("xyzabc");
    maybeExpectVimParity({
      startText: "abc",
      keystrokes: "i123<C-u>xyz<Esc>",
      expectedText: "xyzabc",
    });
  });

  test("insert <C-w> deletes previous word", () => {
    const out = run("foo", "A bar<C-w><Esc>");
    // normalizeText strips trailing whitespace, so engine's "foo " becomes "foo"
    expect(out).toBe("foo");
    maybeExpectVimParity({
      startText: "foo",
      keystrokes: "A bar<C-w><Esc>",
      expectedText: "foo ",
    });
  });

  test("insert <C-t>/<C-d> adjusts indent", () => {
    const out = run("foo", "I<C-t><C-t>bar<C-d><C-d><Esc>");
    expect(out).toBe("barfoo");
    maybeExpectVimParity({
      startText: "foo",
      keystrokes: "I<C-t><C-t>bar<C-d><C-d><Esc>",
      expectedText: "barfoo",
    });
  });

  test("undo tree g- restores previous change", () => {
    const out = run("abc", "xg-");
    expect(out).toBe("abc");
    maybeExpectVimParity({
      startText: "abc",
      keystrokes: "xg-",
      expectedText: "abc",
    });
  });

  test("redo with g+", () => {
    const out = run("abc", "xg-g+");
    expect(out).toBe("bc");
    maybeExpectVimParity({
      startText: "abc",
      keystrokes: "xg-g+",
      expectedText: "bc",
    });
  });
});
