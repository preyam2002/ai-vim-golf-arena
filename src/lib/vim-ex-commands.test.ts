import { describe, expect, test } from "vitest";
import { createInitialState, executeKeystroke, tokenizeKeystrokes } from "./vim-engine";

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
  });

  test("fallback escape lets literal paren replacement proceed", () => {
    const start = "a)b";
    const state = runKeystrokes(start, ":%s/)/x/g<CR>");
    expect(state.lines.join("\n")).toBe("axb");
  });
});

