"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChallengeHeader } from "@/components/challenge/challenge-header";
import { ModelSelector } from "@/components/arena/model-selector";
import { EditorPane } from "@/components/arena/editor-pane";
import { Leaderboard } from "@/components/challenge/leaderboard";
import { StatsPanel } from "@/components/challenge/stats-panel";
import { LiveArena } from "@/components/arena/live-arena";
import type { Challenge, RunResult } from "@/lib/types";
import { availableModels } from "@/lib/ai-gateway";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
  countKeystrokes,
} from "@/lib/vim-engine";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Build MODEL_NAMES from availableModels
const MODEL_NAMES: Record<string, string> = Object.fromEntries(
  availableModels.map((m) => [m.id, m.name])
);

type ChallengeResponse = {
  challenge: Challenge;
  cacheStatus?: {
    missingModelIds: string[];
    hasAllCached: boolean;
  };
};

const isResultInProgress = (result?: RunResult) =>
  result?.status === "in-progress" ||
  result?.status === "verifying" ||
  result?.status === "pending";

function replayKeystrokes(startText: string, keystrokes: string): string {
  let state = createInitialState(startText);
  let remaining = keystrokes ?? "";

  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode);
    if (!stroke) break;
    state = executeKeystroke(state, stroke);
    remaining = remaining.slice(stroke.length);
  }

  return state.lines.join("\n");
}

function evaluateResultWithReplay(
  result: RunResult,
  challenge?: Challenge | null,
  startText?: string,
  targetText?: string
): RunResult {
  if (!challenge || !startText || !targetText) return result;

  try {
    const hasFinalText = !!result.finalText && result.finalText.length > 0;
    const computedFinalText = hasFinalText
      ? result.finalText
      : replayKeystrokes(startText, result.keystrokes ?? "");

    const success =
      normalizeText(computedFinalText) === normalizeText(targetText);

    const computedKeystrokeCount =
      typeof result.keystrokeCount === "number" && result.keystrokeCount > 0
        ? result.keystrokeCount
        : countKeystrokes(result.keystrokes ?? "");

    return {
      ...result,
      finalText: computedFinalText,
      success,
      keystrokeCount: computedKeystrokeCount,
    };
  } catch (e) {
    console.warn("[ChallengePage] Failed to replay result", e);
    return result;
  }
}

export default function ChallengePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataParam = useMemo(() => searchParams.get("data"), [searchParams]);
  const [selectedModels, setSelectedModels] = useState<string[]>(() =>
    availableModels.map((m) => m.id)
  );
  const [results, setResults] = useState<RunResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customChallenge, setCustomChallenge] = useState<Challenge | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const lastResultsSignature = useRef<string>("");

  useEffect(() => {
    if (id === "custom") {
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
  }, [id, dataParam]);

  const { data, isLoading } = useSWR<ChallengeResponse>(
    id !== "custom" ? `/api/challenge?id=${id}` : null,
    fetcher
  );

  const challenge = id === "custom" ? customChallenge : data?.challenge;
  const missingModelIds =
    challenge?.id === "custom"
      ? availableModels.map((m) => m.id)
      : data?.cacheStatus?.missingModelIds ?? [];
  const missingModelNames = missingModelIds.map(
    (modelId) => MODEL_NAMES[modelId] || modelId
  );
  const shouldShowApiKeyInput =
    (challenge?.id === "custom" ? true : missingModelIds.length > 0) &&
    !!challenge;

  useEffect(() => {
    if (
      id === "random" &&
      !isLoading &&
      challenge?.id &&
      challenge.id !== "random"
    ) {
      router.replace(`/challenge/${challenge.id}`);
    }
  }, [id, isLoading, challenge?.id, router]);

  const handleResultsComplete = useCallback(
    (newResults: RunResult[]) => {
      const evaluatedResults = newResults.map((r) =>
        evaluateResultWithReplay(
          r,
          challenge,
          challenge?.startText,
          challenge?.targetText
        )
      );

      const signature = JSON.stringify(
        evaluatedResults.map((r) => ({
          id: r.modelId,
          status: r.status,
          success: r.success,
          timeMs: r.timeMs,
          keystrokeCount: r.keystrokeCount,
        }))
      );
      if (signature === lastResultsSignature.current) return;
      lastResultsSignature.current = signature;

      setResults(evaluatedResults);
      setSelectedResult((prev) => {
        if (evaluatedResults.length === 0) return null;

        const updatedPrev = prev
          ? evaluatedResults.find((r) => r.modelId === prev.modelId)
          : undefined;
        if (updatedPrev) return updatedPrev;

        const firstFinished = evaluatedResults.find(
          (r) => !isResultInProgress(r)
        );

        return firstFinished ?? evaluatedResults[0];
      });
    },
    [challenge]
  );

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

  const playHref = `/challenge/${id}/play${
    id === "custom" && customChallenge
      ? `?data=${encodeURIComponent(
          JSON.stringify({
            title: customChallenge.title,
            startText: customChallenge.startText,
            targetText: customChallenge.targetText,
          })
        )}`
      : ""
  }`;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="font-semibold">Vimgolf AI Arena</span>
          </Link>
        </div>
      </nav>

      <ChallengeHeader
        challenge={challenge}
        ctaSlot={
          <Link
            href={playHref}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Play this challenge yourself
          </Link>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* START and TARGET text */}
        <div className="grid gap-3 lg:grid-cols-2">
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
        <div className="mt-3">
          <ModelSelector
            selectedModels={selectedModels}
            onSelectionChange={setSelectedModels}
            disabled={false}
          />
        </div>

        {shouldShowApiKeyInput && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <label className="block text-sm font-medium text-foreground">
                Enter your AI Gateway API key
              </label>
              <span className="text-xs text-muted-foreground">
                Used only when cached runs are missing; never stored.
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="vck_-..."
              className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {challenge?.id === "custom" ? (
                <p>API key is required to run custom challenges.</p>
              ) : missingModelNames.length > 0 ? (
                <p>
                  No cached runs exist yet for {missingModelNames.join(", ")}.
                  Provide a key to generate them.
                </p>
              ) : null}
              <p>Your key stays in this session only.</p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Live Simulation Arena
          </h2>
          <LiveArena
            challenge={challenge}
            selectedModels={selectedModels}
            modelNames={MODEL_NAMES}
            onResultsComplete={handleResultsComplete}
            apiKey={apiKey}
            requiresApiKey={shouldShowApiKeyInput}
            missingModelIds={missingModelIds}
          />
        </div>

        {/* Results section - shows after run completes */}
        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Leaderboard
                results={results}
                bestHumanScore={challenge.bestHumanScore}
                selectedResultId={selectedResult?.modelId}
                selectedResult={selectedResult}
                onSelectResult={setSelectedResult}
                expectedText={challenge.targetText}
              />

              <div className="flex gap-2 overflow-x-auto pb-2">
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

            <StatsPanel result={selectedResult} />
          </div>
        )}
      </div>
    </div>
  );
}
