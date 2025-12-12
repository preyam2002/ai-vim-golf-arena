/**
 * Streaming-friendly wrapper around the Vim simulator for incremental input.
 */

import { VimSimulator } from "./vim-simulator";
import type { ReplayStep } from "./types";

export class StreamingVimSimulator {
  private simulator: VimSimulator;
  private rawInput = "";
  private processedIndex = 0;
  private steps: ReplayStep[] = [];
  private startText: string;

  constructor(startText: string) {
    this.startText = startText;
    this.simulator = new VimSimulator(startText);
    this.steps = [
      {
        keystroke: "START",
        text: startText,
        cursorLine: 0,
        cursorCol: 0,
        mode: "normal",
        commandLine: null,
      },
    ];
  }

  // Add new tokens from the stream
  appendTokens(tokens: string): ReplayStep[] {
    this.rawInput += tokens;
    return this.processNewKeystrokes();
  }

  private processNewKeystrokes(): ReplayStep[] {
    const newSteps: ReplayStep[] = [];

    // Parse and execute any complete keystrokes we haven't processed yet
    while (this.processedIndex < this.rawInput.length) {
      const remaining = this.rawInput.slice(this.processedIndex);

      // Check if we have a complete keystroke
      const keystroke = this.extractNextKeystroke(remaining);
      if (!keystroke) break; // Incomplete keystroke, wait for more tokens

      // Execute the keystroke
      try {
        this.simulator.executeSingleKeystroke(keystroke);
        const step: ReplayStep = {
          keystroke,
          text: this.simulator.getText(),
          cursorLine: this.simulator.getCursorLine(),
          cursorCol: this.simulator.getCursorCol(),
          mode: this.simulator.getMode() as
            | "normal"
            | "insert"
            | "replace"
            | "command"
            | "visual"
            | "visual-line"
            | "visual-block",
          commandLine: this.simulator.getCommandLine(),
        };
        this.steps.push(step);
        newSteps.push(step);
      } catch (e) {
        // Skip invalid keystrokes
      }

      this.processedIndex += keystroke.length;
    }

    return newSteps;
  }

  private extractNextKeystroke(input: string): string | null {
    if (input.length === 0) return null;

    // Handle special keys like <Esc>, <CR>, <BS>
    if (input[0] === "<") {
      const endIdx = input.indexOf(">");
      if (endIdx === -1) return null; // Incomplete special key
      return input.slice(0, endIdx + 1);
    }

    // Handle command mode (collect until <CR>)
    if (input[0] === ":") {
      const crIdx = input.indexOf("<CR>");
      if (crIdx === -1) {
        // Check if we have an incomplete command
        if (input.includes("<") && !input.includes(">")) {
          return null; // Wait for complete special key
        }
        // Return single colon if no command follows
        return null;
      }
      return input.slice(0, crIdx + 4);
    }

    // Regular single character
    return input[0];
  }

  getSteps(): ReplayStep[] {
    return this.steps;
  }

  getText(): string {
    return this.simulator.getText();
  }

  getRawKeystrokes(): string {
    return this.rawInput;
  }

  getProcessedKeystrokes(): string {
    return this.rawInput.slice(0, this.processedIndex);
  }

  reset() {
    this.simulator = new VimSimulator(this.startText);
    this.rawInput = "";
    this.processedIndex = 0;
    this.steps = [
      {
        keystroke: "START",
        text: this.startText,
        cursorLine: 0,
        cursorCol: 0,
        mode: "normal",
        commandLine: null,
      },
    ];
  }
}
