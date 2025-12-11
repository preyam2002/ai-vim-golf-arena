import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
} from "./vim-engine";
import { PI_DIGITS } from "./vim-ex-commands";
import { maybeExpectVimParity } from "./test-parity";

function runKeystrokes(text: string, ks: string) {
  let state = createInitialState(text);
  for (const token of tokenizeKeystrokes(ks)) {
    state = executeKeystroke(state, token);
  }
  return state;
}

describe("vim ex command robustness", () => {
  test("invalid substitute regex is skipped without modifying text", () => {
    const start = "foo\nbar\n";
    const state = runKeystrokes(start, ":%s/)/)/g<CR>");
    expect(state.lines.join("\n")).toBe(start);
    expect(state.mode).toBe("normal");
    expect(state.commandLine).toBeNull();
    maybeExpectVimParity({
      startText: start,
      keystrokes: ":%s/)/)/g<CR>",
      expectedText: start,
    });
  });

  test("fallback escape lets literal paren replacement proceed", () => {
    const start = "a)b";
    const state = runKeystrokes(start, ":%s/)/x/g<CR>");
    expect(state.lines.join("\n")).toBe("axb");
    maybeExpectVimParity({
      startText: start,
      keystrokes: ":%s/)/x/g<CR>",
      expectedText: "axb",
    });
  });

  test("substitute handles escaped delimiter for Vim-style \\/", () => {
    const start = "(DMY): 09/10/2024";
    const ks =
      ":%s/(DMY): \\([0-9][0-9]\\)\\/\\([0-9][0-9]\\)\\/\\([0-9]\\{4\\}\\)/(YMD): \\3\\/\\2\\/\\1/g<CR>";
    const state = runKeystrokes(start, ks);
    expect(state.lines.join("\n")).toBe("(YMD): 2024/10/09");
    maybeExpectVimParity({
      startText: start,
      keystrokes: ks,
      expectedText: "(YMD): 2024/10/09",
    });
  });

  test("substitute supports multi-digit backreferences", () => {
    const start = "abcdefghij";
    const ks =
      ":%s/\\v(\\w)(\\w)(\\w)(\\w)(\\w)(\\w)(\\w)(\\w)(\\w)(\\w)/\\10\\9\\8\\7\\6\\5\\4\\3\\2\\1/<CR>";
    const state = runKeystrokes(start, ks);
    expect(state.lines.join("\n")).toBe("jihgfedcba");
    maybeExpectVimParity({
      startText: start,
      keystrokes: ks,
      expectedText: "jihgfedcba",
    });
  });

  test(":put=Pi() inserts digits and digraph inserts π", () => {
    const start = "fu! Pi()\nlet x=''";
    const state = runKeystrokes(start, "ggdG:put=Pi()<CR>o<C-K>p*<Esc>");
    expect(state.lines).toEqual([PI_DIGITS, "π"]);
    expect(state.mode).toBe("normal");
    maybeExpectVimParity({
      startText: start,
      keystrokes: "ggdG:put=Pi()<CR>o<C-K>p*<Esc>",
      expectedText: `${PI_DIGITS}\nπ`,
    });
  });

  test(":r ! with Pi helper stubs shell output", () => {
    const start = "";
    const state = runKeystrokes(
      start,
      ":r !vim -c 'let @a=Pi()|%p' -es +\"norm G$xx\" +q<CR>"
    );
    expect(state.lines).toEqual([PI_DIGITS]);
    maybeExpectVimParity({
      startText: start,
      keystrokes: ":r !vim -c 'let @a=Pi()|%p' -es +\"norm G$xx\" +q<CR>",
      expectedText: PI_DIGITS,
    });
  });
});
