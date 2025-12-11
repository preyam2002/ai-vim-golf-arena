import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";
import { maybeExpectVimParity } from "../src/lib/test-parity";

function run(text: string, ks: string) {
  let state = createInitialState(text);
  for (const token of tokenizeKeystrokes(ks)) {
    state = executeKeystroke(state, token);
  }
  return normalizeText(state.lines.join("\n"));
}

describe("motion/operator combos", () => {
  test("dw deletes word", () => {
    const out = run("foo bar baz", "dw");
    expect(out).toBe("bar baz");
    return maybeExpectVimParity({
      startText: "foo bar baz",
      keystrokes: "dw",
      expectedText: "bar baz",
    });
  });

  test("d$ deletes to end of line", () => {
    const out = run("abc def", "d$");
    expect(out).toBe("");
    return maybeExpectVimParity({
      startText: "abc def",
      keystrokes: "d$",
      expectedText: "",
    });
  });

  test("caw changes a word", () => {
    const out = run("hello world", "cawbye<Esc>");
    expect(out).toBe("byeworld");
    return maybeExpectVimParity({
      startText: "hello world",
      keystrokes: "cawbye<Esc>",
      expectedText: "byeworld",
    });
  });

  test("ct, change to comma", () => {
    const out = run("abc,def", "ct,XYZ<Esc>");
    expect(out).toBe("XYZ,def");
    return maybeExpectVimParity({
      startText: "abc,def",
      keystrokes: "ct,XYZ<Esc>",
      expectedText: "XYZ,def",
    });
  });
});
