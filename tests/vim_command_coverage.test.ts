import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";

function run(text: string, keystrokes: string) {
  let state = createInitialState(text);
  for (const token of tokenizeKeystrokes(keystrokes)) {
    state = executeKeystroke(state, token);
  }
  return normalizeText(state.lines.join("\n"));
}

describe("vim command coverage", () => {
  test("global substitute with capture groups", () => {
    const out = run("foo foo\nbar", ":%s/foo/bar/g<CR>");
    expect(out).toBe("bar bar\nbar");
  });

  test("global delete of blank lines", () => {
    const out = run("a\n\nb\n\n\nc\n", ":g/^$/d<CR>");
    expect(out).toBe("a\nb\nc");
  });

  test("numeric count with delete lines", () => {
    const out = run("1\n2\n3\n4\n5\n", "3dd");
    expect(out).toBe("4\n5");
  });

  test("visual block insert prefix", () => {
    const out = run("a\nb\nc", "<C-v>jjI# <Esc>");
    expect(out).toBe("# a\n# b\n# c");
  });

  test("append and repeat", () => {
    const out = run("a\nb", "A;<Esc>j.");
    expect(out).toBe("a;\nb;");
  });

  test("substitute with escaped ampersand", () => {
    const out = run("aa\nab", ":%s/a/&x/g<CR>");
    expect(out).toBe("axax\naxb");
  });

  test("join lines with count", () => {
    const out = run("a\nb\nc\nd", "2J");
    expect(out).toBe("a b\nc\nd");
  });

  test("uppercase word using gUiw", () => {
    const out = run("hello world", "w gUiw");
    expect(out).toBe("hello WORLD");
  });

  test("yank and paste with numbered registers", () => {
    const out = run("one\ntwo\nthree", "yyjp");
    expect(out).toBe("one\ntwo\none\nthree");
  });

  test('change inside quotes ci"', () => {
    const out = run('say "hello" now', 'f"ci"bye<Esc>');
    expect(out).toBe('say "bye" now');
  });
});
