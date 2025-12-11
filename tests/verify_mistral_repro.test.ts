import { describe, test, expect } from "vitest";
import { runVimParity } from "../src/lib/vim-parity";

process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

describe("Strict Parity Debugging", () => {
  test("static-7 (Mistral Repro)", () => {
    const startText = "line1\n\nline2\n\n\nline3";
    // Try literal newline char
    const keystrokes = ":%s/\n\\{2,}/\\r/g<CR>ggdd";

    const result = runVimParity({
      startText,
      keystrokes,
      vimBin: "nvim",
      timeoutMs: 5000,
    });

    console.log("Input:", JSON.stringify(keystrokes));
    console.log("Engine:", JSON.stringify(result.engineNormalized));
    console.log("Vim:   ", JSON.stringify(result.vimNormalized));

    expect(result.engineNormalized).toBe(result.vimNormalized);
  });
});
