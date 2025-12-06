"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import type { ReplayStep, RunResult } from "@/lib/types";
import {
  executeKeystroke,
  extractKeystroke,
  normalizeText,
  countKeystrokes,
  createInitialState,
  type VimState,
} from "@/lib/vim-engine";
import { VimTextDisplay } from "./vim-text-display";
import { cleanKeystrokes } from "@/lib/ai-gateway";

interface StreamingModelCardProps {
  modelId: string;
  modelName: string;
  startText: string;
  targetText: string;
  bestHumanScore: number;
  isRunning: boolean;
  runStartedAt?: number | null;
  playSpeed: number;
  onComplete: (result: RunResult) => void;
  onProgress?: (result: RunResult) => void;
  challengeId?: string;
  apiKey?: string;
  onAbort?: () => void;
}

export function StreamingModelCard({
  modelId,
  modelName,
  startText,
  targetText,
  bestHumanScore,
  isRunning,
  runStartedAt,
  playSpeed,
  onComplete,
  onProgress,
  challengeId,
  apiKey,
  onAbort,
}: StreamingModelCardProps) {
  const [status, setStatus] = useState<
    "idle" | "streaming" | "verifying" | "complete"
  >("idle");
  const [playbackMode, setPlaybackMode] = useState<
    "live" | "paused" | "replay"
  >("live");
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [success, setSuccess] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  // isPlaying is now derived from playbackMode or managed locally for replay
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeMsRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const progressTickerRef = useRef<NodeJS.Timeout | null>(null);
  const simulatorRef = useRef<{
    rawInput: string;
    processedIndex: number;
    vimState: VimState;
  } | null>(null);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const keystrokeHistoryRef = useRef<HTMLDivElement>(null);
  const longPressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rawKeystrokesRef = useRef("");
  const lastProgressEmitRef = useRef(0);
  const stepsRef = useRef(steps);
  const hasStartedRunRef = useRef(false);
  const runStartedAtRef = useRef<number | null | undefined>(runStartedAt);
  const [, setDisplayTick] = useState(0);

  useEffect(() => {
    runStartedAtRef.current = runStartedAt;
  }, [runStartedAt]);

  const stopLongPress = useCallback(() => {
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (progressTickerRef.current) {
      clearInterval(progressTickerRef.current);
      progressTickerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (startTime?: number) => {
      startTimeRef.current = startTime ?? Date.now();
      stopTimer();

      const tick = () => {
        if (startTimeRef.current === null) return;
        const elapsed = Math.round(Date.now() - startTimeRef.current);
        if (elapsed > timeMsRef.current) {
          setTimeMs(elapsed);
          timeMsRef.current = elapsed;
        }
        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [stopTimer]
  );

  const startLongPress = useCallback(
    (direction: "forward" | "backward") => {
      // Immediate first step
      setPlaybackMode("paused");
      setCurrentStepIndex((prev) => {
        if (direction === "forward")
          return Math.min(steps.length - 1, prev + 1);
        return Math.max(0, prev - 1);
      });

      // Start interval after a small delay to distinguish click from long press
      // But for responsiveness, we can just start the interval with a slight initial delay logic if needed.
      // Simple interval for now:
      longPressIntervalRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (direction === "forward") {
            if (prev >= steps.length - 1) {
              stopLongPress();
              return prev;
            }
            return prev + 1;
          } else {
            if (prev <= 0) {
              stopLongPress();
              return prev;
            }
            return prev - 1;
          }
        });
      }, 100); // 100ms interval for fast seeking
    },
    [steps.length, stopLongPress]
  );

  useEffect(() => {
    timeMsRef.current = timeMs;
  }, [timeMs]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    runStartedAtRef.current = runStartedAt;
  }, [runStartedAt]);

  const emitProgress = useCallback(
    (opts?: { force?: boolean }) => {
      if (!onProgressRef.current || !simulatorRef.current) return;

      const now = Date.now();
      if (!opts?.force && now - lastProgressEmitRef.current < 200) return;
      lastProgressEmitRef.current = now;

      const rawInput = simulatorRef.current.rawInput;
      const cleanedInput = cleanKeystrokes(rawInput);
      const keystrokeCount = countKeystrokes(cleanedInput);
      const currentText = simulatorRef.current.vimState.lines.join("\n");
      const normalizedFinal = normalizeText(currentText);
      const normalizedTarget = normalizeText(targetText);

      const partialResult: RunResult = {
        modelId,
        modelName,
        keystrokes: cleanedInput,
        keystrokeCount,
        timeMs: timeMsRef.current,
        success: normalizedFinal === normalizedTarget,
        finalText: currentText,
        steps: stepsRef.current,
        diffFromBest: keystrokeCount - bestHumanScore,
        status: "in-progress",
      };

      onProgressRef.current(partialResult);
    },
    [modelId, modelName, targetText, bestHumanScore]
  );

  const processTokens = useCallback(
    (tokens: string) => {
      if (!simulatorRef.current) return;

      const sim = simulatorRef.current;
      sim.rawInput += tokens;
      rawKeystrokesRef.current = sim.rawInput;

      // Sanitize input for simulation
      // We need to handle markdown code blocks that might be partially streamed
      let effectiveInput = sim.rawInput;

      // Check for markdown code block start
      const codeBlockStart = effectiveInput.match(/^```(?:vim|text)?\n/);
      if (codeBlockStart) {
        // We are inside a code block: remove the start tag
        effectiveInput = effectiveInput.slice(codeBlockStart[0].length);

        // Check for end tag
        const codeBlockEnd = effectiveInput.indexOf("\n```");
        if (codeBlockEnd !== -1) {
          // We have a closing tag, take everything up to it
          effectiveInput = effectiveInput.slice(0, codeBlockEnd);
        }
      } else if (effectiveInput.startsWith("```")) {
        // We have a start tag but not the full newline yet, or just the tag.
        // Treat as empty to avoid executing backticks as commands.
        effectiveInput = "";
      }

      // Process complete keystrokes from the sanitized input
      // sim.processedIndex tracks the position within effectiveInput
      while (sim.processedIndex < effectiveInput.length) {
        const remaining = effectiveInput.slice(sim.processedIndex);
        const keystroke = extractKeystroke(remaining, sim.vimState.mode);
        if (!keystroke) break;

        // Execute keystroke and create step
        sim.vimState = executeKeystroke(sim.vimState, keystroke);

        const step: ReplayStep = {
          keystroke,
          text: sim.vimState.lines.join("\n"),
          cursorLine: sim.vimState.cursorLine,
          cursorCol: sim.vimState.cursorCol,
          mode: sim.vimState.mode,
          commandLine: sim.vimState.commandLine,
        };

        setSteps((prev) => [...prev, step]);
        sim.processedIndex += keystroke.length;
      }
      emitProgress();
    },
    [emitProgress]
  );

  const finishSimulation = useCallback(async () => {
    stopTimer();
    setStatus("verifying");

    // Use latest values from ref to avoid stale closure issues
    const currentRawInput = simulatorRef.current?.rawInput || "";

    // Use VimSimulator result directly
    const finalText =
      simulatorRef.current?.vimState.lines.join("\n") || startText;

    console.log(
      `[StreamingModelCard] Simulation finished. Final text length: ${finalText.length}`
    );

    // Verify against target using VimSimulator result
    const normalizedFinal = normalizeText(finalText);
    const normalizedTarget = normalizeText(targetText);
    const isSuccess = normalizedFinal === normalizedTarget;

    console.log(`[StreamingModelCard] Verification (VimSimulator):
      Success: ${isSuccess}
      Final Length: ${finalText.length}
      Target Length: ${targetText.length}
      Normalized Final: ${JSON.stringify(normalizedFinal)}
      Normalized Target: ${JSON.stringify(normalizedTarget)}
    `);

    setSuccess(isSuccess);
    setStatus("complete");
    // Switch to paused mode so user can replay if they want,
    // but we stay at the end (which live mode did)
    setPlaybackMode("paused");

    const cleanedInput = cleanKeystrokes(currentRawInput);
    console.log(
      `[StreamingModelCard] Final Command (${modelId}):`,
      JSON.stringify(cleanedInput)
    );
    const keystrokeCount = countKeystrokes(cleanedInput);
    const finalElapsed =
      startTimeRef.current !== null
        ? Math.max(
            timeMsRef.current,
            Math.round(Date.now() - startTimeRef.current)
          )
        : timeMsRef.current;
    setTimeMs(finalElapsed);
    timeMsRef.current = finalElapsed;

    const result: RunResult = {
      modelId,
      modelName,
      keystrokes: cleanedInput,
      keystrokeCount: countKeystrokes(cleanedInput),
      timeMs: finalElapsed,
      success: isSuccess,
      finalText,
      steps: stepsRef.current,
      diffFromBest: keystrokeCount - bestHumanScore,
      status: isSuccess ? "complete" : "failed",
    };
    onCompleteRef.current?.(result);
  }, [startText, targetText, modelId, modelName, bestHumanScore]);

  const startStreaming = useCallback(async () => {
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          startText,
          targetText,
          challengeId,
          apiKey,
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log(`[StreamingModelCard] Stream started for model: ${modelId}`);

      if (!response.ok || !response.body) {
        let errorMessage = `Stream failed: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Ignore json parse error
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            finishSimulation();
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // API returns {type: 'token', content: 'x'} format
            if (parsed.type === "token" && parsed.content) {
              // console.log(
              //   `[StreamingModelCard] Received token: ${JSON.stringify(
              //     parsed.content
              //   )}`
              // );
              processTokens(parsed.content);
              setDebugInfo(
                (prev) =>
                  `Last: ${JSON.stringify(parsed.content).slice(
                    0,
                    10
                  )} | Raw[-30]: ${JSON.stringify(
                    simulatorRef.current?.rawInput.slice(-30)
                  )} | CL: ${simulatorRef.current?.vimState.commandLine}`
              );
            }
            if (parsed.timeMs !== undefined) {
              setTimeMs(parsed.timeMs);
              timeMsRef.current = parsed.timeMs; // Update ref immediately
              emitProgress({ force: true });
            }
            if (parsed.type === "debug") {
              // console.log("[Stream Debug]", parsed.message);
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
          }
        }
      }

      finishSimulation();
    } catch (err: any) {
      stopTimer();
      if (err.name === "AbortError") {
        console.log("Streaming aborted");
        return;
      }
      console.error("Streaming error:", err);
      setError(err.message);
      setStatus("complete");

      // Ensure we report completion even on error so the parent component doesn't hang
      const result: RunResult = {
        modelId,
        modelName,
        keystrokes: "",
        keystrokeCount: 0,
        timeMs: 0,
        success: false,
        finalText: startText, // No change
        steps: [],
        diffFromBest: 0,
        status: "error",
      };
      onCompleteRef.current?.(result);
    }
  }, [
    startText,
    targetText,
    modelId,
    challengeId,
    apiKey,
    processTokens,
    finishSimulation,
    stopTimer,
  ]);

  // Reset when starting a new run
  useEffect(() => {
    if (!isRunning) {
      hasStartedRunRef.current = false;
      return;
    }

    // Prevent re-starting the stream on every render when callbacks change identity
    if (hasStartedRunRef.current) return;
    hasStartedRunRef.current = true;

    setStatus("streaming");
    lastProgressEmitRef.current = 0;
    rawKeystrokesRef.current = "";
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
    setCurrentStepIndex(0);
    setSuccess(false);
    setError(null);
    setPlaybackMode("live");

    // Start timing immediately when the run is triggered (prefer shared start)
    stopTimer();
    const startAt = runStartedAtRef.current ?? Date.now();
    startTimeRef.current = startAt;
    timeMsRef.current = 0;
    setTimeMs(Math.max(0, Math.round(Date.now() - startAt)));
    startTimer(startAt);

    // Emit progress ticks even before first token so parent UI sees time moving
    if (!progressTickerRef.current) {
      progressTickerRef.current = setInterval(() => {
        emitProgress({ force: true });
      }, 200);
    }

    // Initialize simulator state
    simulatorRef.current = {
      rawInput: "",
      processedIndex: 0,
      vimState: createInitialState(startText),
    };

    emitProgress({ force: true });
    startStreaming();

    return () => {
      // Reset guard so React strict mode double-invocation can restart the stream
      hasStartedRunRef.current = false;
      stopTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    emitProgress,
    isRunning,
    startStreaming,
    startText,
    startTimer,
    stopTimer,
  ]);

  // Heartbeat to keep display time updating even if the stream is silent
  useEffect(() => {
    if (!isRunning) return;
    const displayInterval = window.setInterval(() => {
      setDisplayTick(Date.now());
    }, 120);
    return () => clearInterval(displayInterval);
  }, [isRunning]);

  // Auto-advance through steps during playback
  useEffect(() => {
    if (playbackMode === "live") {
      // In live mode, always jump to the latest step without re-triggering renders
      const latestIndex = steps.length - 1;
      if (currentStepIndex !== latestIndex) {
        setCurrentStepIndex(latestIndex);
      }
      return;
    }

    if (playbackMode === "replay") {
      if (currentStepIndex >= steps.length - 1) {
        setPlaybackMode("paused");
        return;
      }

      const timer = setTimeout(() => {
        setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
      }, playSpeed);

      return () => clearTimeout(timer);
    }
  }, [playbackMode, steps.length, currentStepIndex, playSpeed]);

  // Auto-scroll keystroke history to current step
  useEffect(() => {
    if (!keystrokeHistoryRef.current || currentStepIndex === 0) return;

    const historyElement = keystrokeHistoryRef.current;
    const currentStepElement = historyElement.querySelector(
      `[data-step="${currentStepIndex}"]`
    ) as HTMLElement | null;

    if (!currentStepElement) return;

    // Manually adjust the scroll position of the history container so we
    // don't scroll the whole page when new steps stream in.
    const { offsetTop, offsetHeight } = currentStepElement;
    const { scrollTop, clientHeight } = historyElement;

    if (offsetTop < scrollTop) {
      historyElement.scrollTo({ top: offsetTop, behavior: "smooth" });
    } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
      historyElement.scrollTo({
        top: offsetTop - clientHeight + offsetHeight,
        behavior: "smooth",
      });
    }
  }, [currentStepIndex]);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopTimer();
    setStatus("complete");
    setPlaybackMode("paused");
    setError("Aborted");
    const result: RunResult = {
      modelId,
      modelName,
      keystrokes: "",
      keystrokeCount: 0,
      timeMs: timeMsRef.current,
      success: false,
      finalText: startText,
      steps,
      diffFromBest: 0,
      status: "aborted",
    };
    onCompleteRef.current?.(result);
    onAbort?.();
  }, [modelId, modelName, startText, steps, onAbort, stopTimer]);

  // Helper function to format keystroke for display
  const formatKeystroke = (keystroke: string): string => {
    if (keystroke === "START") return "[START]";
    // Escape special characters for readability
    return keystroke
      .replace(/\r/g, "<CR>")
      .replace(/\n/g, "<CR>")
      .replace(/\x1b/g, "<Esc>")
      .replace(/\t/g, "<Tab>");
  };

  const currentStep = steps[currentStepIndex];
  // Use current step state for display, fallback to initial state
  const displayState: VimState = currentStep
    ? {
        ...createInitialState(startText),
        lines: currentStep.text.split("\n"),
        cursorLine: currentStep.cursorLine,
        cursorCol: currentStep.cursorCol,
        mode: currentStep.mode as any,
        commandLine: currentStep.commandLine,
      }
    : createInitialState(startText);

  const getStatusColor = () => {
    if (status === "complete") {
      return success
        ? "border-sky-400/50 bg-sky-950/25 shadow-[0_0_18px_rgba(125,211,252,0.18)]"
        : "border-rose-400/50 bg-rose-950/25 shadow-[0_0_18px_rgba(244,114,182,0.18)]";
    }
    if (status === "verifying") {
      return "border-amber-400/50 bg-amber-950/25 shadow-[0_0_18px_rgba(251,191,36,0.16)]";
    }
    if (status === "streaming") {
      return "border-cyan-400/50 bg-cyan-950/25 shadow-[0_0_18px_rgba(34,211,238,0.18)]";
    }
    return "border-white/10 bg-zinc-900/40 hover:border-white/20";
  };

  const getStatusIcon = () => {
    if (status === "streaming" || status === "verifying") {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
    }
    if (status === "complete") {
      return success ? (
        <CheckCircle className="h-5 w-5 text-sky-300" />
      ) : (
        <XCircle className="h-5 w-5 text-rose-300" />
      );
    }
    return <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />;
  };

  const isLiveTiming = status === "streaming" || status === "verifying";
  const displayTimeMs = (() => {
    if (!isLiveTiming) return timeMs;
    const now = Date.now();
    const baseline =
      runStartedAtRef.current ?? runStartedAt ?? startTimeRef.current;
    if (baseline == null) return timeMs;
    return Math.max(timeMs, Math.round(now - baseline));
  })();

  return (
    <div
      className={`neon-card flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-lg shadow-[0_30px_90px_-70px_var(--primary)] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${getStatusColor()}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-white/5 via-black/40 to-black/60 px-4 py-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-display text-lg font-semibold text-white tracking-tight">
              {modelName}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {status === "streaming"
                ? `Streaming... (${currentStepIndex}/${steps.length - 1})`
                : status === "verifying"
                ? "Verifying..."
                : status === "complete"
                ? success
                  ? "Success"
                  : "Failed"
                : "Waiting to start"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-bold text-white">
            {displayTimeMs}ms
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {countKeystrokes(
              simulatorRef.current?.rawInput ?? rawKeystrokesRef.current
            )}{" "}
            chars
          </div>
        </div>
      </div>

      {/* Vim Display */}
      <div className="flex-1 bg-gradient-to-b from-black/80 to-black/60 h-[400px] relative group">
        <VimTextDisplay state={displayState} />

        {/* Overlay for waiting state */}
        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground shadow-[0_10px_40px_-28px_var(--primary)]">
              Ready
            </div>
          </div>
        )}
      </div>

      {/* Keystroke History (always reserved space) */}
      <div className="border-t border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">
        <div className="px-4 py-2 border-b border-white/10">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Keystroke History ({Math.max(steps.length - 1, 0)} steps)
          </h4>
        </div>
        <div
          ref={keystrokeHistoryRef}
          className="h-32 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
        >
          {steps.length <= 1 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/5 bg-white/5 text-[11px] text-muted-foreground">
              Waiting for keystrokes…
            </div>
          ) : (
            steps.slice(1).map((step, idx) => {
              const stepNum = idx + 1;
              const isCurrent = stepNum === currentStepIndex;
              return (
                <div
                  key={stepNum}
                  data-step={stepNum}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] font-mono transition-all duration-200 ${
                    isCurrent
                      ? "bg-primary/20 border border-primary/40 text-primary shadow-[0_10px_30px_-25px_var(--primary)]"
                      : "text-muted-foreground hover:bg-white/5 border border-white/5"
                  }`}
                >
                  <span className="text-[10px] font-bold text-muted-foreground min-w-[2.5rem] text-right">
                    #{stepNum}
                  </span>
                  <span className="flex-1 truncate">
                    {formatKeystroke(step.keystroke)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {step.mode}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/30 px-4 py-2">
        {/* Play/Pause/Replay */}
        <button
          onClick={() => {
            if (status === "streaming") {
              // If streaming, we can't really "pause" the stream, but we can pause the view
              // For now, let's just toggle between live and paused view
              setPlaybackMode(playbackMode === "live" ? "paused" : "live");
            } else {
              // Replay mode
              if (currentStepIndex >= steps.length - 1) {
                // Restart
                setCurrentStepIndex(0);
                setPlaybackMode("replay");
              } else {
                setPlaybackMode(
                  playbackMode === "replay" ? "paused" : "replay"
                );
              }
            }
          }}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          title={
            playbackMode === "live" || playbackMode === "replay"
              ? "Pause"
              : "Play"
          }
        >
          {playbackMode === "live" || playbackMode === "replay" ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Reset / Replay from start */}
        <button
          onClick={() => {
            setCurrentStepIndex(0);
            setPlaybackMode("paused");
          }}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          title="Go to start and pause"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Step Back */}
        <button
          onMouseDown={() => startLongPress("backward")}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          disabled={currentStepIndex === 0}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-30 active:bg-white/20"
          title="Step Back (Hold to seek)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Step Forward */}
        <button
          onMouseDown={() => startLongPress("forward")}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          disabled={currentStepIndex >= steps.length - 1}
          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-30 active:bg-white/20"
          title="Step Forward (Hold to seek)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={abortStream}
            disabled={status === "complete"}
            className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-100 transition-colors hover:border-rose-300 hover:text-rose-50 disabled:opacity-40"
            title="Abort this model"
          >
            Abort
          </button>
          {playbackMode === "live" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                LIVE
              </span>
            </div>
          )}
          <div className="text-xs font-mono text-muted-foreground">
            STEP {currentStepIndex}/{steps.length - 1}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="border-t border-rose-500/30 bg-rose-950/40 px-4 py-2 text-xs font-medium text-rose-300">
          Error: {error}
        </div>
      )}

      {/* Debug info (hidden by default, maybe toggleable later) */}
      {/* <div className="border-t border-white/5 bg-black/40 px-4 py-1 text-[10px] text-zinc-600 font-mono truncate">
        Debug: {debugInfo}
      </div> */}
    </div>
  );
}
