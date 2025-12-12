import { describe, test, expect } from "vitest";
import { tokenizeKeystrokes } from "../src/lib/vim-engine";

describe("Tokenization edge cases", () => {
  test("colon after cw should not be Ex command", () => {
    const k1 = "cw: List<Esc>";
    const k2 = "cw: List<CR>";
    const k3 = "cw: List<Esc>jjddtotal<CR>";

    console.log("k1 tokens:", tokenizeKeystrokes(k1));
    console.log("k2 tokens:", tokenizeKeystrokes(k2));
    console.log("k3 tokens:", tokenizeKeystrokes(k3));

    // Without colon
    const k4 = "cwList<Esc>";
    console.log("k4 tokens:", tokenizeKeystrokes(k4));
  });
});
