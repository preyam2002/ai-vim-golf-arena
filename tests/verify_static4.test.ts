import { describe, test, expect } from "vitest";
import { runVimParity } from "../src/lib/vim-parity";

process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

describe("Strict Parity Debugging", () => {
  test("static-4 (Gemini): gUgG behavior", () => {
    // Challenge: Uppercase lines?
    // Start: "hello world"
    // Keystrokes: "gUgG"

    // Expectation:
    // Engine: Uppercase all (treating gG as G or something valid)
    // Vim: Unchanged (treating gG as invalid motion)

    const startText = "hello world\nthis is vim golf";
    const keystrokes = "gUgG";

    const result = runVimParity({
      startText,
      keystrokes,
      vimBin: "nvim",
    });

    console.log("Static-4 Engine:", JSON.stringify(result.engineNormalized));
    console.log("Static-4 Vim:   ", JSON.stringify(result.vimNormalized));

    expect(result.engineNormalized).toBe(result.vimNormalized);
  });
});
