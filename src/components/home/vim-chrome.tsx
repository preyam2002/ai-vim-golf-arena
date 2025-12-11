"use client";

import { cn } from "@/lib/utils";

type VimChromeProps = {
  className?: string;
};

export function VimChrome({ className }: VimChromeProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 select-none text-[11px] uppercase tracking-[0.18em]",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute left-4 top-4 flex items-center gap-2 text-primary">
        <span className="flex h-2 w-2 items-center justify-center rounded-[2px] bg-primary shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
        <span className="rounded-sm bg-white/5 px-2 py-1 font-semibold text-[10px] text-foreground ring-1 ring-white/10 backdrop-blur">
          NORMAL
        </span>
        <span className="rounded-sm bg-white/5 px-2 py-1 font-semibold text-[10px] text-foreground ring-1 ring-white/10 backdrop-blur">
          arena.vim
        </span>
      </div>

      <div className="absolute left-0 right-0 bottom-0">
        <div className="mx-3 mb-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[10px] text-muted-foreground shadow-[0_20px_60px_-50px_rgba(0,0,0,0.8)] backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-primary">NORMAL</span>
            <span>arena/hero-3d.vim</span>
            <span className="text-muted-foreground/80">utf-8 · 120 lines</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-foreground/80">
            <span className="text-primary">:</span>
            <span className="opacity-90">wq</span>
            <span className="opacity-40">|</span>
            <span className="opacity-70">:help</span>
            <span className="opacity-40">|</span>
            <span className="opacity-70">/precision</span>
          </div>
        </div>
      </div>
    </div>
  );
}



