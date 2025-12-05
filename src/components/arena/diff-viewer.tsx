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
    return Diff.diffChars(expected, actual);
  }, [expected, actual]);

  if (viewMode === "split") {
    return (
      <div
        className={cn(
          "neon-card grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-sm backdrop-blur-lg",
          className
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Expected
          </div>
          <div className="whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-white/5 p-2 h-full">
            {diff.map((part, index) => {
              if (part.added) return null; // Skip added parts in expected view
              const color = part.removed
                ? "bg-sky-500/15 text-sky-300"
                : "text-muted-foreground";
              return (
                <span key={index} className={cn("px-0.5", color)}>
                  {part.value}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">
            Actual
          </div>
          <div className="whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-white/5 p-2 h-full">
            {diff.map((part, index) => {
              if (part.removed) return null; // Skip removed parts in actual view
              const color = part.added
                ? "bg-rose-500/15 text-rose-300"
                : "text-muted-foreground";
              return (
                <span key={index} className={cn("px-0.5", color)}>
                  {part.value}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "neon-card rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-sm backdrop-blur-lg",
        className
      )}
    >
      <div className="whitespace-pre-wrap break-all">
        {diff.map((part, index) => {
          const color = part.added
            ? "bg-rose-500/15 text-rose-300"
            : part.removed
            ? "bg-sky-500/15 text-sky-300"
            : "text-muted-foreground";

          return (
            <span key={index} className={cn("px-0.5", color)}>
              {part.value}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-sky-500/20" />
          <span className="text-muted-foreground">Expected (Missing)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-rose-500/20" />
          <span className="text-muted-foreground">Actual (Extra)</span>
        </div>
      </div>
    </div>
  );
}
