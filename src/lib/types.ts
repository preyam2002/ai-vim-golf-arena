export interface Challenge {
  id: string;
  title: string;
  description: string;
  startText: string;
  targetText: string;
  bestHumanScore: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  isThinking?: boolean;
}

export interface RunResult {
  modelId: string;
  modelName: string;
  keystrokes: string;
  keystrokeCount: number;
  timeMs: number;
  success: boolean;
  finalText: string;
  steps: ReplayStep[];
  diffFromBest: number;
  status?:
    | "pending"
    | "in-progress"
    | "verifying"
    | "complete"
    | "failed"
    | "aborted"
    | "error";
  /**
   * Detailed token arrival timeline for replaying the exact streaming cadence.
   * timestampMs is relative to stream start.
   */
  tokenTimeline?: TokenTimelineEntry[];
}

export interface ReplayStep {
  keystroke: string;
  text: string;
  cursorLine: number;
  cursorCol: number;
  mode: VimMode;
  commandLine: string | null;
}

export type VimMode =
  | "normal"
  | "insert"
  | "replace"
  | "command"
  | "visual"
  | "visual-line"
  | "visual-block"
  | "commandline";

export interface VimState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  mode: VimMode;
  commandBuffer: string;
  registerBuffer: string;
}

export interface LeaderboardEntry {
  modelId: string;
  modelName: string;
  keystrokeCount: number;
  timeMs: number;
  success: boolean;
  diffFromBest: number;
}

export interface TokenTimelineEntry {
  token: string;
  timestampMs: number;
}
