import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";

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
  });

  test("d$ deletes to end of line", () => {
    const out = run("abc def", "fdd$");
    expect(out).toBe("abc ");
  });

  test("caw changes a word", () => {
    const out = run("hello world", "cawbye<Esc>");
    expect(out).toBe("bye world");
  });

  test("ct, change to comma", () => {
    const out = run("abc,def", "ct,XYZ<Esc>");
    expect(out).toBe("abcXYZ,def");
  });
});
