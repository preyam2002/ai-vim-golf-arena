"use client";

import * as Diff from "diff";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  expected: string;
  actual: string;
  className?: string;
  viewMode?: "inline" | "split";
}

export function DiffViewer({
  expected,
  actual,
  className,
  viewMode = "inline",
}: DiffViewerProps) {
  const diff = useMemo(() => {
    return Diff.diffWordsWithSpace(expected, actual);
  }, [expected, actual]);

  const stats = useMemo(() => {
    return diff.reduce(
      (acc, part) => {
        const len = part.value.length;
        if (part.added) acc.added += len;
        else if (part.removed) acc.removed += len;
        else acc.unchanged += len;
        return acc;
      },
      { added: 0, removed: 0, unchanged: 0 }
    );
  }, [diff]);

  const hasChanges = stats.added + stats.removed > 0;

  const renderChunk = (
    part: Diff.Change,
    key: number,
    hideAdded: boolean,
    hideRemoved: boolean
  ) => {
    if ((hideAdded && part.added) || (hideRemoved && part.removed)) return null;
    const color = part.added
      ? "bg-rose-500/15 text-rose-100"
      : part.removed
      ? "bg-sky-500/20 text-sky-100"
      : "text-foreground";
    return (
      <span key={key} className={cn("rounded px-1", color)}>
        {part.value}
      </span>
    );
  };

  const renderSummary = () => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="font-semibold text-foreground">Diff</span>
      <span className="rounded-full bg-sky-500/15 px-2 py-1 text-sky-100">
        -{stats.removed} removed
      </span>
      <span className="rounded-full bg-rose-500/15 px-2 py-1 text-rose-100">
        +{stats.added} added
      </span>
      <span className="rounded-full bg-muted px-2 py-1 text-foreground">
        {stats.unchanged} unchanged
      </span>
    </div>
  );

  if (!hasChanges) {
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100",
          className
        )}
      >
        Perfect match — no differences found.
      </div>
    );
  }

  if (viewMode === "split") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-3 font-mono text-sm",
          className
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Expected
            </div>
          </div>
          <div className="rounded-md bg-background/80 p-2 shadow-inner">
            <pre className="whitespace-pre-wrap wrap-break-word leading-6 text-foreground">
              {diff.map((part, idx) => renderChunk(part, idx, true, false))}
            </pre>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Actual
            </div>
          </div>
          <div className="rounded-md bg-background/80 p-2 shadow-inner">
            <pre className="whitespace-pre-wrap wrap-break-word leading-6 text-foreground">
              {diff.map((part, idx) => renderChunk(part, idx, false, true))}
            </pre>
          </div>
        </div>
        <div className="col-span-2">{renderSummary()}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border bg-muted/20 p-3 font-mono text-sm",
        className
      )}
    >
      {renderSummary()}
      <div className="rounded-md bg-background/80 p-2 shadow-inner">
        <pre className="whitespace-pre-wrap wrap-break-word leading-6">
          {diff.map((part, idx) => renderChunk(part, idx, false, false))}
        </pre>
      </div>
    </div>
  );
}
