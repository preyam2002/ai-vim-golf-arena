import { describe, test, expect } from "vitest";
import {
  tokenizeKeystrokes,
  executeKeystroke,
  createInitialState,
} from "../src/lib/vim-engine";

describe("Trace bundled token execution", () => {
  test("execute bundled insert token", () => {
    const startText = "def test\nline2\nline3";
    const keystrokes = "cw: List<Esc>jjddtotal<CR>";
    const tokens = tokenizeKeystrokes(keystrokes);
    console.log("Tokens:", tokens);

    let state = createInitialState(startText);
    console.log("Initial:", state.lines[0]);

    for (let i = 0; i < tokens.length; i++) {
      console.log(
        `\nProcessing token ${i}: "${tokens[i].substring(0, 30)}${
          tokens[i].length > 30 ? "..." : ""
        }"`
      );
      console.log(
        `  Before: mode=${state.mode} cursor=${state.cursorLine}:${state.cursorCol}`
      );
      state = executeKeystroke(state, tokens[i]);
      console.log(
        `  After:  mode=${state.mode} cursor=${state.cursorLine}:${state.cursorCol}`
      );
      console.log(`  Line 0: ${state.lines[0].substring(0, 50)}`);
    }

    console.log("\nFinal:", state.lines.join("\\n"));
  });
});
