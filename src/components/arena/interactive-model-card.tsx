"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, XCircle, Play, RotateCcw, Keyboard } from "lucide-react";
import type { ReplayStep, RunResult } from "@/lib/types";
import {
  executeKeystroke,
  tokenizeKeystrokes,
  formatToken,
  normalizeText,
  countKeystrokes,
  createInitialState,
  type VimState,
} from "@/lib/vim-engine";
import { VimTextDisplay } from "./vim-text-display";

interface InteractiveModelCardProps {
  modelId: string;
  modelName: string;
  startText: string;
  targetText: string;
  bestHumanScore: number;
  isRunning: boolean;
  onComplete: (result: RunResult) => void;
}

export function InteractiveModelCard({
  modelId,
  modelName,
  startText,
  targetText,
  bestHumanScore,
  isRunning,
  onComplete,
}: InteractiveModelCardProps) {
  const [status, setStatus] = useState<"idle" | "playing" | "complete">("idle");
  const [rawKeystrokes, setRawKeystrokes] = useState("");
  const [vimState, setVimState] = useState<VimState>(
    createInitialState(startText)
  );
  const [steps, setSteps] = useState<ReplayStep[]>([
    {
      keystroke: "START",
      text: startText,
      cursorLine: 0,
      cursorCol: 0,
      mode: "normal",
      commandLine: null,
    },
  ]);
  const [success, setSuccess] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset when starting a new run
  useEffect(() => {
    if (isRunning && status === "idle") {
      setStatus("playing");
      setRawKeystrokes("");
      setVimState(createInitialState(startText));
      setSteps([
        {
          keystroke: "START",
          text: startText,
          cursorLine: 0,
          cursorCol: 0,
          mode: "normal",
          commandLine: null,
        },
      ]);
      setSuccess(false);
      setStartTime(Date.now());
      setElapsedTime(0);

      // Focus the container to capture keystrokes
      setTimeout(() => containerRef.current?.focus(), 100);
    }
  }, [isRunning, startText, status]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "playing" && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (status !== "playing") return;

      e.preventDefault();
      e.stopPropagation();

      let key = e.key;

      // Map special keys to Vim notation
      if (key === "Escape") key = "<Esc>";
      else if (key === "Enter") key = "<CR>";
      else if (key === "Backspace") key = "<BS>";
      else if (key === "Tab") key = "<Tab>";
      else if (key.length > 1) {
        // Ignore other special keys for now unless they are valid Vim commands
        return;
      }

      // Update state
      const newState = executeKeystroke(vimState, key);

      setVimState(newState);

      const newKeystrokes = rawKeystrokes + key;
      setRawKeystrokes(newKeystrokes);

      const step: ReplayStep = {
        keystroke: key,
        text: newState.lines.join("\n"),
        cursorLine: newState.cursorLine,
        cursorCol: newState.cursorCol,
        mode: newState.mode,
        commandLine: newState.commandLine,
      };
      setSteps((prev) => [...prev, step]);
    },
    [status, vimState, rawKeystrokes]
  );

  const handleFinish = () => {
    if (status !== "playing") return;

    const finalText = vimState.lines.join("\n");
    const isSuccess = normalizeText(finalText) === normalizeText(targetText);
    setSuccess(isSuccess);
    setStatus("complete");

    const keystrokeCount = countKeystrokes(rawKeystrokes);
    const result: RunResult = {
      modelId,
      modelName,
      keystrokes: rawKeystrokes,
      keystrokeCount,
      timeMs: elapsedTime,
      success: isSuccess,
      finalText,
      steps,
      diffFromBest: keystrokeCount - bestHumanScore,
      status: isSuccess ? "complete" : "failed",
    };
    onComplete(result);
  };

  const handleReset = () => {
    setStatus("idle");
    setRawKeystrokes("");
    setVimState(createInitialState(startText));
    setSteps([
      {
        keystroke: "START",
        text: startText,
        cursorLine: 0,
        cursorCol: 0,
        mode: "normal",
        commandLine: null,
      },
    ]);
    setSuccess(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  // Tokenize keystrokes for display
  const allTokens = tokenizeKeystrokes(rawKeystrokes);

  return (
    <div
      ref={containerRef}
      className={`neon-card flex flex-col rounded-2xl border border-white/10 bg-black/50 overflow-hidden h-full outline-none ring-offset-background transition-colors ${
        status === "playing"
          ? "ring-2 ring-primary border-primary"
          : "border-border"
      }`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-white/5 via-black/40 to-black/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-white truncate max-w-[140px]">
            {modelName}
          </span>
          {status === "playing" && (
            <Keyboard className="h-3 w-3 animate-pulse text-primary drop-shadow-[0_0_12px_var(--primary)]" />
          )}
          {status === "complete" && (
            <>
              {success ? (
                <CheckCircle className="h-4 w-4 text-sky-300" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-300" />
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`rounded px-1.5 py-0.5 font-mono border ${
              vimState.mode === "insert"
                ? "bg-primary/15 text-primary border-primary/40"
                : vimState.mode === "replace"
                ? "bg-amber-500/15 text-amber-300 border-amber-400/40"
                : "bg-white/5 text-foreground border-white/10"
            }`}
          >
            {vimState.mode}
          </span>
        </div>
      </div>

      {/* Live keystrokes display */}
      <div className="border-b border-white/10 px-3 py-2 bg-black/40">
        <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-2 uppercase tracking-[0.18em]">
          Keystrokes
          {status === "playing" && (
            <span className="text-primary text-[10px]">(Type to play)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-[11px] max-h-16 overflow-y-auto">
          {allTokens.map((token, i) => (
            <span
              key={i}
              className="rounded-lg px-1.5 py-0.5 bg-white/5 text-muted-foreground border border-white/5"
            >
              {formatToken(token)}
            </span>
          ))}
          {status === "playing" && (
            <span className="animate-pulse text-primary">▌</span>
          )}
        </div>
      </div>

      {/* Editor view */}
      <div
        className="flex-1 overflow-auto min-h-[140px] max-h-[220px] bg-black/60 cursor-text"
        onClick={() => containerRef.current?.focus()}
      >
        <VimTextDisplay state={vimState} />
      </div>

      {/* Controls & Stats */}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-3 py-2">
        <div className="flex items-center gap-2">
          {status === "playing" ? (
            <button
              onClick={handleFinish}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-[0_12px_40px_-28px_var(--primary)] transition hover:-translate-y-0.5"
            >
              Finish
            </button>
          ) : (
            <button
              onClick={handleReset}
              disabled={status === "idle"}
              className="rounded-lg p-1.5 text-xs font-semibold border border-white/10 bg-white/5 text-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Keys:{" "}
            <span className="text-foreground font-medium">
              {countKeystrokes(rawKeystrokes)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Time:{" "}
            <span className="text-foreground font-medium">{elapsedTime}ms</span>
          </span>
        </div>
      </div>
    </div>
  );
}
