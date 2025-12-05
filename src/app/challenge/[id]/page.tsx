"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChallengeHeader } from "@/components/challenge/challenge-header";
import { ModelSelector } from "@/components/arena/model-selector";
import { EditorPane } from "@/components/arena/editor-pane";
import { Leaderboard } from "@/components/challenge/leaderboard";
import { StatsPanel } from "@/components/challenge/stats-panel";
import { LiveArena } from "@/components/arena/live-arena";
import type { Challenge, RunResult } from "@/lib/types";
import { availableModels } from "@/lib/ai-gateway";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Build MODEL_NAMES from availableModels
const MODEL_NAMES: Record<string, string> = Object.fromEntries(
  availableModels.filter((m) => m.id !== "user").map((m) => [m.id, m.name])
);

export default function ChallengePage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customChallenge, setCustomChallenge] = useState<Challenge | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (id === "custom") {
      const dataParam = searchParams.get("data");
      if (dataParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(dataParam));
          setCustomChallenge({
            id: "custom",
            title: parsed.title || "Custom Challenge",
            description: "User-created custom challenge",
            startText: parsed.startText,
            targetText: parsed.targetText,
            bestHumanScore: 0,
          });
        } catch {
          setError("Failed to parse custom challenge data");
        }
      }
    } else if (id === "daily") {
      // For daily challenge, auto-select all models to simulate the "battle"
      setSelectedModels(Object.keys(MODEL_NAMES));
    }
  }, [id, searchParams, MODEL_NAMES]);

  const { data, isLoading } = useSWR<{ challenge: Challenge }>(
    id !== "custom" ? `/api/challenge?id=${id}` : null,
    fetcher
  );

  const challenge = id === "custom" ? customChallenge : data?.challenge;

  const [userBestResult, setUserBestResult] = useState<RunResult | null>(null);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`vim-golf-scores-${id}`);
      if (saved) {
        try {
          const scores = JSON.parse(saved) as {
            keystrokes: number;
            timeMs: number;
            date: string;
          }[];
          if (scores.length > 0) {
            // Find best score (lowest keystrokes, then lowest time)
            const best = scores.reduce((prev, current) => {
              if (current.keystrokes !== prev.keystrokes) {
                return current.keystrokes < prev.keystrokes ? current : prev;
              }
              return current.timeMs < prev.timeMs ? current : prev;
            });

            setUserBestResult({
              modelId: "user-local",
              modelName: "You",
              keystrokes: "", // Not stored in local score summary
              keystrokeCount: best.keystrokes,
              timeMs: best.timeMs,
              success: true,
              finalText: "", // Not needed for leaderboard
              steps: [],
              diffFromBest: best.keystrokes - (challenge?.bestHumanScore || 0),
            });
          }
        } catch (e) {
          console.error("Failed to load local scores", e);
        }
      }
    }
  }, [id, challenge]);

  const handleResultsComplete = useCallback((newResults: RunResult[]) => {
    setResults(newResults);
    if (newResults.length > 0) {
      setSelectedResult(newResults[0]);
    }
  }, []);

  if (id !== "custom" && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Loading challenge...</span>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Challenge not found
          </h1>
          <Link
            href="/"
            className="mt-4 inline-block text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const shouldShowInput = id !== "daily";

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-semibold">AI Vim Golf Arena</span>
          </Link>
        </div>
      </nav>

      <ChallengeHeader challenge={challenge} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* START and TARGET text */}
        <div className="grid gap-6 lg:grid-cols-2">
          <EditorPane
            title="START"
            content={challenge.startText}
            className="h-64"
          />
          <EditorPane
            title="TARGET"
            content={challenge.targetText}
            className="h-64"
          />
        </div>

        {/* Model selector */}
        <div className="mt-6">
          <ModelSelector
            selectedModels={selectedModels}
            onSelectionChange={setSelectedModels}
            disabled={false}
          />
        </div>

        {/* {shouldShowInput && (
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <label className="mb-2 block text-sm font-medium text-foreground">
              AI Gateway API Key (Required for custom/random challenges)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This key is used to power the AI models. It is not stored.
            </p>
          </div>
        )} */}

        {/* Practice Arena Link */}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/challenge/${id}/play${
              id === "custom" && customChallenge
                ? `?data=${encodeURIComponent(
                    JSON.stringify({
                      title: customChallenge.title,
                      startText: customChallenge.startText,
                      targetText: customChallenge.targetText,
                    })
                  )}`
                : ""
            }`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Play this Challenge
          </Link>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Live Simulation Arena
          </h2>
          <LiveArena
            challenge={challenge}
            selectedModels={selectedModels}
            modelNames={MODEL_NAMES}
            onResultsComplete={handleResultsComplete}
            apiKey={apiKey}
          />
        </div>

        {/* Results section - shows after run completes */}
        {(results.length > 0 || userBestResult) && (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Leaderboard
                results={results}
                bestHumanScore={challenge.bestHumanScore}
                userResult={userBestResult}
                selectedResultId={selectedResult?.modelId}
                selectedResult={selectedResult}
                onSelectResult={setSelectedResult}
                expectedText={challenge.targetText}
              />

              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {results.map((result) => (
                  <button
                    key={result.modelId}
                    onClick={() => setSelectedResult(result)}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      selectedResult?.modelId === result.modelId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-accent"
                    }`}
                  >
                    {result.modelName}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <StatsPanel result={selectedResult} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
