import { describe, test, expect } from "vitest";
import { runVimParity } from "../src/lib/vim-parity";
import {
  tokenizeKeystrokes,
  executeKeystroke,
  createInitialState,
} from "../src/lib/vim-engine";

describe("Trace 9v006715 step by step", () => {
  test("step through engine execution", () => {
    const startText =
      "def calculateTotalPrice(items List[Double], discountPercentage int): Double = {\n  val subtotal = items.sum\n  val discountAmount = subtotal * (discountPercentage / 100)\n  val total = subtotal - discountAmount\n  return total\n}\n";

    const keystrokes =
      "cw: List[Double], discountPercentage: Int<Esc>jjjjA.0<Esc>jjddtotal<CR>";
    const tokens = tokenizeKeystrokes(keystrokes);
    console.log("Tokens:", tokens);

    let state = createInitialState(startText);
    console.log("Initial lines:", state.lines.length);
    console.log("Initial first line:", state.lines[0].substring(0, 50));

    for (let i = 0; i < tokens.length && i < 5; i++) {
      console.log(
        `\n--- Processing token ${i}: ${tokens[i].substring(0, 30)}...`
      );
      state = executeKeystroke(state, tokens[i]);
      console.log(
        `Mode: ${state.mode}, Cursor: ${state.cursorLine}:${state.cursorCol}`
      );
      console.log(`First line: ${state.lines[0].substring(0, 60)}`);
    }
  });
});
