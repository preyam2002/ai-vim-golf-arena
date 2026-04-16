"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChallengeHeader } from "@/components/challenge/challenge-header";
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
    console.warn("[SoloPage] Failed to replay result", e);
    return result;
  }
}

interface SingleModelPickerProps {
  selectedModel: string;
  onSelect: (modelId: string) => void;
  missingModelIds: string[];
}

function SingleModelPicker({
  selectedModel,
  onSelect,
  missingModelIds,
}: SingleModelPickerProps) {
  return (
    <div className="neon-card rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-lg shadow-[0_30px_80px_-70px_var(--primary)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            roster
          </p>
          <h3 className="font-display text-lg text-white">Select a Model</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          Single-model arena
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {availableModels.map((model) => {
          const active = selectedModel === model.id;
          const missing = missingModelIds.includes(model.id);
          return (
            <label
              key={model.id}
              className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-150 ${
                active
                  ? "border-primary/60 bg-primary/10 shadow-[0_15px_50px_-35px_var(--primary)]"
                  : "border-white/10 bg-white/5 hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="solo-model"
                checked={active}
                onChange={() => onSelect(model.id)}
                className="h-4 w-4 border-white/20 text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {model.name}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
                  {model.provider}
                  {missing ? " · live" : " · cached"}
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {active ? "ON" : "OFF"}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function SoloChallengePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataParam = useMemo(() => searchParams.get("data"), [searchParams]);
  const modelParam = useMemo(() => searchParams.get("model"), [searchParams]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const fromParam =
      modelParam && availableModels.some((m) => m.id === modelParam)
        ? modelParam
        : null;
    return fromParam ?? availableModels[0]?.id ?? "";
  });
  const [results, setResults] = useState<RunResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customChallenge, setCustomChallenge] = useState<Challenge | null>(
    null
  );
  const [apiKey] = useState("");
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

  useEffect(() => {
    if (
      id === "random" &&
      !isLoading &&
      challenge?.id &&
      challenge.id !== "random"
    ) {
      router.replace(`/solo/${challenge.id}`);
    }
  }, [id, isLoading, challenge?.id, router]);

  const selectedModels = useMemo(
    () => (selectedModel ? [selectedModel] : []),
    [selectedModel]
  );

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
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Solo mode
          </span>
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
        <div className="grid gap-3 lg:grid-cols-2">
          <EditorPane
            title="START"
            content={challenge.startText}
            className="h-96"
          />
          <EditorPane
            title="TARGET"
            content={challenge.targetText}
            className="h-96"
          />
        </div>

        {/* Single-model picker */}
        <div className="mt-3">
          <SingleModelPicker
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            missingModelIds={missingModelIds}
          />
        </div>

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
            requiresApiKey={missingModelIds.length > 0}
            missingModelIds={missingModelIds}
          />
        </div>

        {/* Results section - shows after run completes */}
        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            <Leaderboard
              results={results}
              bestHumanScore={challenge.bestHumanScore}
              selectedResultId={selectedResult?.modelId}
              selectedResult={selectedResult}
              onSelectResult={setSelectedResult}
              expectedText={challenge.targetText}
            />
            <StatsPanel result={selectedResult} />
          </div>
        )}
      </div>
    </div>
  );
}
