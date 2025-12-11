import { describe, test, expect } from "vitest";
import { runVimParity } from "../src/lib/vim-parity";

process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

describe("Strict Parity Debugging", () => {
  test("static-7 (Claude 3.7 Sonnet Failure)", () => {
    // Exact input from replay failure
    // Logic from Challenge static-7: "Collapse newlines"
    // Start: "line1\n\nline2\n\n\nline3"
    // Keystrokes: (Derived from model, likely involving :%s or similar)
    // Wait, I need the EXACT keystrokes that caused the failure.
    // The replay log doesn't show keystrokes, only result.
    // Assuming standard failure keystrokes: :%s/\n\{2,}/\r/g<CR>ggdd

    // I will test TWO variants seen in logs:
    // 1. Join failure?
    // 2. Extra newline?

    const startText = "line1\n\nline2\n\n\nline3";
    const keystrokes = ":%s/\\n\\{2,}/\\r/g<CR>ggdd";

    const result = runVimParity({
      startText,
      keystrokes,
      vimBin: "nvim",
    });

    console.log("Engine:", JSON.stringify(result.engineNormalized));
    console.log("Vim:   ", JSON.stringify(result.vimNormalized));

    expect(result.engineNormalized).toBe(result.vimNormalized);
  });
});
