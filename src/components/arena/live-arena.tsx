"use client";

import { useState, useCallback } from "react";
import { StreamingModelCard } from "./streaming-model-card";
import { InteractiveModelCard } from "./interactive-model-card";
import { Loader2, Play, RotateCcw } from "lucide-react";
import type { Challenge, RunResult } from "@/lib/types";

interface LiveArenaProps {
  challenge: Challenge;
  selectedModels: string[];
  modelNames: Record<string, string>;
  onResultsComplete: (results: RunResult[]) => void;
  apiKey?: string;
}

export function LiveArena({
  challenge,
  selectedModels,
  modelNames,
  onResultsComplete,
  apiKey,
}: LiveArenaProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runKey, setRunKey] = useState(0); // Used to reset/restart all cards
  const [playSpeed, setPlaySpeed] = useState(100);
  const [completedResults, setCompletedResults] = useState<
    Map<string, RunResult>
  >(new Map());

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setRunKey((prev) => prev + 1);
    setCompletedResults(new Map());
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setRunKey((prev) => prev + 1);
    setCompletedResults(new Map());
  }, []);

  const handleModelComplete = useCallback(
    (result: RunResult) => {
      setCompletedResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(result.modelId, result);

        // Check if all models completed
        if (newMap.size === selectedModels.length) {
          const allResults = Array.from(newMap.values());
          // Sort by success, then keystroke count, then time
          allResults.sort((a, b) => {
            if (a.success !== b.success) return a.success ? -1 : 1;
            if (a.keystrokeCount !== b.keystrokeCount)
              return a.keystrokeCount - b.keystrokeCount;
            return a.timeMs - b.timeMs;
          });
          // Defer to avoid setState during render
          setTimeout(() => {
            onResultsComplete(allResults);
            setIsRunning(false);
          }, 0);
        }

        return newMap;
      });
    },
    [selectedModels.length, onResultsComplete]
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
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="neon-card flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/50 px-6 py-5 shadow-[0_30px_80px_-70px_var(--primary)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
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
            disabled={!isRunning && completedResults.size === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-medium text-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
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
              {completedResults.size}/{selectedModels.length} complete
            </div>
          )}
        </div>
      </div>

      {/* Live simulation grid */}
      <div
        className={`grid gap-4 ${
          selectedModels.length === 1
            ? "grid-cols-1"
            : selectedModels.length === 2
            ? "grid-cols-1 md:grid-cols-2"
            : selectedModels.length <= 4
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {selectedModels.map((modelId) =>
          modelId === "user" ? (
            <InteractiveModelCard
              key={`${modelId}-${runKey}`}
              modelId={modelId}
              modelName={modelNames[modelId] || "You"}
              startText={challenge.startText}
              targetText={challenge.targetText}
              bestHumanScore={challenge.bestHumanScore}
              isRunning={isRunning}
              onComplete={handleModelComplete}
            />
          ) : (
            <StreamingModelCard
              key={`${modelId}-${runKey}`}
              modelId={modelId}
              modelName={modelNames[modelId] || modelId}
              startText={challenge.startText}
              targetText={challenge.targetText}
              bestHumanScore={challenge.bestHumanScore}
              isRunning={isRunning}
              playSpeed={playSpeed}
              onComplete={handleModelComplete}
              challengeId={challenge.id}
              apiKey={apiKey}
            />
          )
        )}
      </div>
    </div>
  );
}
