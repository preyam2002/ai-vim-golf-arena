import { describe, test, expect } from "vitest";
import {
  tokenizeKeystrokes,
  executeKeystroke,
  createInitialState,
} from "../src/lib/vim-engine";

describe("Full 9v006715 execution trace", () => {
  test("trace all tokens", () => {
    const startText =
      "def calculateTotalPrice(items List[Double], discountPercentage int): Double = {\n  val subtotal = items.sum\n  val discountAmount = subtotal * (discountPercentage / 100)\n  val total = subtotal - discountAmount\n  return total\n}\n";

    const keystrokes =
      "cw: List[Double], discountPercentage: Int<Esc>jjjjA.0<Esc>jjddtotal<CR>";
    const tokens = tokenizeKeystrokes(keystrokes);
    console.log("Tokens:", tokens);

    let state = createInitialState(startText);
    console.log("Initial first line:", state.lines[0].substring(0, 50));

    for (const token of tokens) {
      console.log(`\n--- Processing token: ${token.substring(0, 50)}...`);
      console.log(
        `Before mode: ${state.mode}, cursor: ${state.cursorLine}:${state.cursorCol}`
      );
      state = executeKeystroke(state, token);
      console.log(
        `After mode: ${state.mode}, cursor: ${state.cursorLine}:${state.cursorCol}`
      );
      console.log(`First line: ${state.lines[0].substring(0, 80)}`);
    }

    console.log("\nFinal text:", state.lines.join("\n"));
  });
});
