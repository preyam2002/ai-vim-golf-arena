/**
 * Lightweight, deterministic Vim simulator used throughout the app.
 * Executes keystrokes with the same parser as the UI components.
 */

import type { ReplayStep } from "./types";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  type VimState,
} from "./vim-engine";

export class VimSimulator {
  private state: VimState;
  private steps: ReplayStep[] = [];

  constructor(initialText: string) {
    this.state = createInitialState(initialText);
    this.recordStep("START");
  }

  private recordStep(keystroke: string): void {
    // console.log(`[VimSimulator] Recording step: ${keystroke}`);
    this.steps.push({
      keystroke,
      text: this.getText(),
      cursorLine: this.state.cursorLine,
      cursorCol: this.state.cursorCol,
      mode: this.state.mode as ReplayStep["mode"],
      commandLine: this.state.commandLine || null,
    });
  }

  getText(): string {
    return this.state.lines.join("\n");
  }

  getSteps(): ReplayStep[] {
    return this.steps;
  }

  // Getter methods for streaming simulator
  getCursorLine(): number {
    return this.state.cursorLine;
  }

  getCursorCol(): number {
    return this.state.cursorCol;
  }

  getMode(): string {
    return this.state.mode;
  }

  getCommandLine(): string | null {
    return this.state.commandLine || null;
  }

  executeSingleKeystroke(token: string): void {
    this.executeToken(token);
  }

  executeKeystrokes(keystrokes: string): void {
    const tokens = this.tokenize(keystrokes);
    for (const token of tokens) {
      this.executeToken(token);
      this.recordStep(token);
    }
  }

  tokenize(keystrokes: string): string[] {
    return tokenizeKeystrokes(keystrokes);
  }

  private executeToken(token: string): void {
    // console.log(`[VimSimulator] Executing token: ${token}`);
    this.state = executeKeystroke(this.state, token);
  }
}
