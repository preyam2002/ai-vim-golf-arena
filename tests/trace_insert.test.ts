import { describe, test, expect } from "vitest";
import {
  tokenizeKeystrokes,
  executeKeystroke,
  createInitialState,
} from "../src/lib/vim-engine";

describe("Trace insert mode", () => {
  test("step through insert mode", () => {
    const startText = "def calculateTotalPrice";

    let state = createInitialState(startText);
    console.log("Initial:", state.lines[0]);

    // c - pending operator
    state = executeKeystroke(state, "c");
    console.log(
      "After 'c':",
      state.lines[0],
      "mode:",
      state.mode,
      "pendingOp:",
      state.pendingOperator
    );

    // w - motion, should delete "def" and enter insert
    state = executeKeystroke(state, "w");
    console.log(
      "After 'w':",
      state.lines[0],
      "mode:",
      state.mode,
      "cursor:",
      state.cursorLine,
      state.cursorCol
    );

    // Now type ": List" - should insert
    state = executeKeystroke(state, ": List<Esc>");
    console.log("After insert:", state.lines[0], "mode:", state.mode);
  });
});
