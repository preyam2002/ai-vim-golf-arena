import { expect } from "vitest";
import { runVimParityAsync, type VimParityResult } from "./vim-parity";
import { normalizeText, type VimState } from "./vim-engine";

type ParityInput = {
  startText: string;
  expectedText?: string;
  keystrokes?: string;
  tokens?: string[];
  initialCursor?: { line: number; col: number };
  timeoutMs?: number;
  initialState?: Partial<VimState>;
};

const SHOULD_CHECK_PARITY = process.env.PARITY_ALL === "1";

/**
 * Async parity check that compares ENGINE output vs REAL VIM output.
 * Ignores expectedText - we want to know if our engine matches vim,
 * not if vim matches our expectations.
 */
export async function maybeExpectVimParity({
  startText,
  expectedText,
  keystrokes,
  tokens,
  initialCursor,
  timeoutMs,
  initialState,
}: ParityInput): Promise<void> {
  if (!SHOULD_CHECK_PARITY) return;

  const parity = await runVimParityAsync({
    startText,
    expectedText,
    keystrokes,
    tokens,
    timeoutMs,
    initialState: {
      ...(initialCursor
        ? { cursorLine: initialCursor.line, cursorCol: initialCursor.col }
        : {}),
      ...(initialState ?? {}),
    },
  });

  // Compare engine output vs real vim output (ignore expectedText for parity)
  expect(parity.engineNormalized).toBe(parity.vimNormalized);
}
