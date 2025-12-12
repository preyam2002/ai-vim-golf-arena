import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { DiffViewer } from "@/components/arena/diff-viewer";
import type { RunResult } from "@/lib/types";

interface LeaderboardProps {
  results: RunResult[];
  bestHumanScore: number;
  userResult?: RunResult | null;
  onSelectResult?: (result: RunResult) => void;
  selectedResultId?: string;
  selectedResult?: RunResult | null;
  expectedText: string;
}

type SortKey = "rank" | "model" | "keystrokes" | "diff" | "time" | "status";

const statusPriority: Record<
  Exclude<RunResult["status"], undefined> | "undefined",
  number
> = {
  complete: 0,
  failed: 0,
  undefined: 0,
  verifying: 1,
  "in-progress": 2,
  pending: 2,
  aborted: 3,
  error: 4,
};

const isInProgressStatus = (status?: RunResult["status"]) =>
  status === "in-progress" || status === "verifying" || status === "pending";

export function Leaderboard({
  results,
  bestHumanScore,
  userResult,
  onSelectResult,
  selectedResultId,
  selectedResult,
  expectedText,
}: LeaderboardProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({
    key: "rank",
    direction: "asc",
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <span className="text-[10px] text-muted-foreground">↕</span>;
    }
    return (
      <span className="text-[10px] text-foreground">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (results.length === 0 && !userResult) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="text-muted-foreground">
          Run models to see the leaderboard
        </div>
      </div>
    );
  }

  // Combine and sort results
  const allResults = [...results];
  if (userResult) {
    allResults.push(userResult);
  }

  const sortedResults = useMemo(() => {
    const compareByRank = (a: RunResult, b: RunResult) => {
      const statusDiff =
        (statusPriority[a.status ?? "undefined"] ?? 2) -
        (statusPriority[b.status ?? "undefined"] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      if (a.success !== b.success) return a.success ? -1 : 1;
      if (a.keystrokeCount !== b.keystrokeCount)
        return a.keystrokeCount - b.keystrokeCount;
      return a.timeMs - b.timeMs;
    };

    const direction = sortConfig.direction === "asc" ? 1 : -1;

    return [...allResults].sort((a, b) => {
      let value = 0;
      const statusDiff =
        (statusPriority[a.status ?? "undefined"] ?? 2) -
        (statusPriority[b.status ?? "undefined"] ?? 2);
      if (statusDiff !== 0) {
        return statusDiff * direction;
      }
      switch (sortConfig.key) {
        case "model":
          value = a.modelName.localeCompare(b.modelName);
          break;
        case "keystrokes":
          value = a.keystrokeCount - b.keystrokeCount;
          if (value === 0) value = a.timeMs - b.timeMs;
          break;
        case "diff":
          value = a.diffFromBest - b.diffFromBest;
          break;
        case "time":
          value = a.timeMs - b.timeMs;
          break;
        case "status":
          value =
            (statusPriority[a.status ?? "undefined"] ?? 2) -
            (statusPriority[b.status ?? "undefined"] ?? 2);
          if (value === 0) value = Number(b.success) - Number(a.success);
          if (value === 0) value = compareByRank(a, b);
          break;
        case "rank":
        default:
          value = compareByRank(a, b);
      }
      return value * direction;
    });
  }, [allResults, sortConfig]);

  const firstFinishedResult =
    sortedResults.find((r) => !isInProgressStatus(r.status)) ??
    sortedResults[0];

  const activeResult =
    selectedResult ??
    sortedResults.find((r) => r.modelId === selectedResultId) ??
    firstFinishedResult;

  const renderStatusBadge = (result: RunResult) => {
    const status = result.status;
    if (status === "in-progress" || status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          In progress
        </span>
      );
    }
    if (status === "verifying") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verifying
        </span>
      );
    }
    if (status === "aborted") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
          <XCircle className="h-3 w-3" />
          Aborted
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-200">
          <XCircle className="h-3 w-3" />
          Error
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    }
    return result.success ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
        <CheckCircle2 className="h-3 w-3" />
        Success
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">Leaderboard</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("rank")}
                >
                  <span>Rank</span>
                  {renderSortIndicator("rank")}
                </button>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("model")}
                >
                  <span>Model</span>
                  {renderSortIndicator("model")}
                </button>
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("keystrokes")}
                >
                  <span>Keystrokes</span>
                  {renderSortIndicator("keystrokes")}
                </button>
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("diff")}
                >
                  <span>vs Human</span>
                  {renderSortIndicator("diff")}
                </button>
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="flex w-full items-center justify-end gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("time")}
                >
                  <span>Time</span>
                  {renderSortIndicator("time")}
                </button>
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <button
                  type="button"
                  className="mx-auto flex items-center gap-1 hover:text-foreground focus:outline-none"
                  onClick={() => handleSort("status")}
                >
                  <span>Status</span>
                  {renderSortIndicator("status")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => {
              const isSelected = selectedResultId === result.modelId;
              const isClickable = Boolean(onSelectResult);

              return (
                <tr
                  key={result.modelId}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => onSelectResult?.(result)}
                  onKeyDown={(event) => {
                    if (!onSelectResult) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectResult(result);
                    }
                  }}
                  aria-selected={isSelected}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                    isSelected ? "bg-primary/10 ring-1 ring-primary/40" : ""
                  } ${
                    isClickable
                      ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-500/20 text-yellow-600"
                          : index === 1
                          ? "bg-gray-400/20 text-gray-400"
                          : index === 2
                          ? "bg-orange-500/20 text-orange-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {result.modelName}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {result.keystrokeCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DiffBadge diff={result.diffFromBest} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {result.timeMs}ms
                  </td>
                  <td className="px-4 py-3 text-center">
                    {renderStatusBadge(result)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/30">
              <td className="px-4 py-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  -
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                Best Human (Global)
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                {bestHumanScore}
              </td>
              <td className="px-4 py-3 text-right">
                <DiffBadge diff={0} />
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">-</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Baseline
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {activeResult && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Diff
            </h4>
            <span className="text-xs text-muted-foreground">
              {activeResult.modelName}
            </span>
          </div>
          {isInProgressStatus(activeResult.status) ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Model is still running—diff will appear once it finishes.
            </div>
          ) : activeResult.status === "aborted" ? (
            <div className="rounded-lg border border-dashed border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              This run was aborted before completion, so no diff is available.
            </div>
          ) : activeResult.status === "error" ? (
            <div className="rounded-lg border border-dashed border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              The run failed due to an error—retry the model to view its output.
            </div>
          ) : (
            <DiffViewer
              expected={expectedText}
              actual={activeResult.finalText}
              viewMode="split"
              className="bg-muted/20 rounded-lg border border-border p-3"
            />
          )}
        </div>
      )}
    </div>
  );
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) {
    return <span className="font-mono text-sm text-primary">=0</span>;
  }
  if (diff < 0) {
    return <span className="font-mono text-sm text-sky-300">{diff}</span>;
  }
  return <span className="font-mono text-sm text-rose-300">+{diff}</span>;
}
