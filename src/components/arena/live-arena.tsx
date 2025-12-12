"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { StreamingModelCard } from "./streaming-model-card";
import { InteractiveModelCard } from "./interactive-model-card";
import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import type { Challenge, RunResult } from "@/lib/types";

interface LiveArenaProps {
  challenge: Challenge;
  selectedModels: string[];
  modelNames: Record<string, string>;
  onResultsComplete: (results: RunResult[]) => void;
  apiKey?: string;
  requiresApiKey?: boolean;
  missingModelIds?: string[];
}

export function LiveArena({
  challenge,
  selectedModels,
  modelNames,
  onResultsComplete,
  apiKey,
  requiresApiKey = false,
  missingModelIds = [],
}: LiveArenaProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runKey, setRunKey] = useState(0); // Used to reset/restart all cards
  const [playSpeed, setPlaySpeed] = useState(100);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [latestResults, setLatestResults] = useState<Map<string, RunResult>>(
    new Map()
  );
  const latestResultsRef = useRef<Map<string, RunResult>>(new Map());
  const [completedModels, setCompletedModels] = useState<Set<string>>(
    new Set()
  );
  const [abortedModels, setAbortedModels] = useState<Set<string>>(new Set());
  const missingModelNames = useMemo(
    () => missingModelIds.map((id) => modelNames[id] || id),
    [missingModelIds, modelNames]
  );
  const apiKeyMissing = requiresApiKey && !apiKey;

  const getStatusRank = useCallback((result: RunResult) => {
    switch (result.status) {
      case "complete":
      case "failed":
      case undefined:
        return 0;
      case "verifying":
        return 1;
      case "in-progress":
      case "pending":
        return 2;
      case "aborted":
        return 3;
      case "error":
        return 4;
      default:
        return 2;
    }
  }, []);

  const sortResults = useCallback(
    (arr: RunResult[]) => {
      return [...arr].sort((a, b) => {
        const statusDiff = getStatusRank(a) - getStatusRank(b);
        if (statusDiff !== 0) return statusDiff;
        if (a.success !== b.success) return a.success ? -1 : 1;
        if (a.keystrokeCount !== b.keystrokeCount)
          return a.keystrokeCount - b.keystrokeCount;
        return a.timeMs - b.timeMs;
      });
    },
    [getStatusRank]
  );

  const upsertResult = useCallback(
    (result: RunResult, markComplete = false) => {
      setLatestResults((prev) => {
        const next = new Map(prev);
        next.set(result.modelId, result);
        latestResultsRef.current = next;
        return next;
      });

      if (markComplete) {
        setCompletedModels((prev) => {
          const next = new Set(prev);
          next.add(result.modelId);

          if (next.size === selectedModels.length) {
            setIsRunning(false);
          }

          return next;
        });
      }
    },
    [selectedModels.length]
  );

  useEffect(() => {
    const sorted = sortResults(Array.from(latestResults.values()));
    onResultsComplete(sorted);
  }, [latestResults, onResultsComplete, sortResults]);

  const resetState = useCallback(() => {
    setRunKey((prev) => prev + 1);
    const emptyMap = new Map();
    setLatestResults(emptyMap);
    latestResultsRef.current = emptyMap;
    setCompletedModels(new Set());
    setAbortedModels(new Set());
    setRunStartedAt(null);
    onResultsComplete([]);
  }, [onResultsComplete]);

  const handleRun = useCallback(() => {
    resetState();
    setRunStartedAt(Date.now());
    setIsRunning(true);
  }, [resetState]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    resetState();
  }, [resetState]);

  const handleModelComplete = useCallback(
    (result: RunResult) => {
      upsertResult(
        {
          ...result,
          status: result.status ?? (result.success ? "complete" : "failed"),
        },
        true
      );
    },
    [upsertResult]
  );

  const handleModelProgress = useCallback(
    (result: RunResult) => {
      upsertResult(
        {
          ...result,
          status: result.status ?? "in-progress",
        },
        false
      );
    },
    [upsertResult]
  );

  if (selectedModels.length === 0) {
    return (
      <div className="neon-card rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
        <p className="text-muted-foreground">
          Select at least one model to start the simulation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="neon-card flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/50 px-6 py-5 shadow-[0_30px_80px_-70px_var(--primary)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl border border-white/10 bg-linear-to-br from-primary/20 to-accent/20 text-primary shadow-inner shadow-black/40" />
          <button
            onClick={handleRun}
            disabled={isRunning || selectedModels.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-primary to-emerald-400 px-6 py-2.5 font-semibold text-primary-foreground shadow-[0_15px_50px_-28px_var(--primary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_50px_-18px_var(--primary)] disabled:translate-y-0 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Streaming...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" />
                Run Simulation
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={!isRunning && latestResults.size === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-medium text-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          {isRunning && (
            <button
              onClick={() => {
                setAbortedModels(new Set(selectedModels));
                setIsRunning(false);
                setRunKey((prev) => prev + 1);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/15 px-4 py-2.5 font-medium text-rose-100 transition-all duration-200 hover:border-rose-300 hover:text-rose-50"
            >
              <Square className="h-4 w-4" />
              Abort all
            </button>
          )}
          {requiresApiKey && (
            <div className="text-[11px] font-medium text-amber-200">
              {apiKeyMissing
                ? "Enter your API key to generate uncached runs."
                : `Using your API key for ${
                    missingModelNames.length || "any"
                  } uncached model(s).`}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="pl-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Replay speed
            </span>
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            >
              <option value={200}>0.5x</option>
              <option value={100}>1x</option>
              <option value={50}>2x</option>
              <option value={20}>5x</option>
            </select>
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              {completedModels.size}/{selectedModels.length} complete
            </div>
          )}
        </div>
      </div>

      {/* Live simulation grid */}
      <div
        className={`grid gap-2 ${
          selectedModels.length === 1
            ? "grid-cols-1"
            : selectedModels.length === 2
            ? "grid-cols-1 md:grid-cols-2"
            : selectedModels.length <= 4
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {selectedModels
          .filter((id) => id !== "user")
          .map((modelId) => (
            <StreamingModelCard
              key={`${modelId}-${runKey}`}
              modelId={modelId}
              modelName={modelNames[modelId] || modelId}
              startText={challenge.startText}
              targetText={challenge.targetText}
              bestHumanScore={challenge.bestHumanScore}
              isRunning={isRunning && !abortedModels.has(modelId)}
              runStartedAt={runStartedAt}
              playSpeed={playSpeed}
              onComplete={handleModelComplete}
              onProgress={handleModelProgress}
              challengeId={challenge.id}
              apiKey={apiKey}
              totalModels={selectedModels.filter((id) => id !== "user").length}
              requiresApiKey={missingModelIds.includes(modelId)}
              onAbort={() =>
                setAbortedModels((prev) => {
                  const next = new Set(prev);
                  next.add(modelId);
                  return next;
                })
              }
            />
          ))}
      </div>
    </div>
  );
}
