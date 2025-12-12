import { describe, test, expect } from "vitest";
import {
  tokenizeKeystrokes,
  executeKeystroke,
  createInitialState,
} from "../src/lib/vim-engine";
import { handleInsertModeKeystroke } from "../src/lib/vim-mode-insert";

describe("Test insert handler directly", () => {
  test("multichar insert with Esc", () => {
    const startText = " calculateTotalPrice";
    let state = createInitialState(startText);
    state.mode = "insert";
    state.cursorCol = 0;

    console.log("Before:", state.lines[0], "mode:", state.mode);

    // Simulate the problematic token
    const token = ": List<Esc>jjj";
    state = handleInsertModeKeystroke(state, token);

    console.log("After:", state.lines[0], "mode:", state.mode);
    console.log("Cursor:", state.cursorLine, state.cursorCol);
  });
});
