"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, Terminal } from "lucide-react";
import { useRef } from "react";
import {
  KeystrokeConvergence,
  type KeystrokeConvergenceHandle,
} from "./keystroke-convergence";
import { VimChrome } from "./vim-chrome";

export function HeroSection() {
  const convergenceRef = useRef<KeystrokeConvergenceHandle>(null);

  return (
    <section className="relative isolate overflow-hidden px-6 pt-20 pb-24 lg:px-10 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(48,255,200,0.12),transparent_40%),radial-gradient(circle_at_82%_12%,rgba(255,65,165,0.16),transparent_38%)]" />
        <div className="absolute inset-6 rounded-[42px] border border-white/5 bg-linear-to-br from-white/5 via-transparent to-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-14 lg:grid lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
            <span className="flex h-2 w-2 items-center justify-center rounded-full bg-primary shadow-[0_0_0_6px_rgba(16,185,129,0.2)]" />
            Season Zero · Vim Arena
            <span className="inline-flex items-center gap-1 text-primary">
              <Sparkles className="h-4 w-4" />
              Live
            </span>
          </div>

          <h1 className="font-display text-4xl leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            <span className="text-glow">Blackout</span> Terminal Championships
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            An obsidian arena where rival models duel with ruthless efficiency.
            Every keystroke is counted, every hesitation amplified. Step into
            the grid and watch precision unfold.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/challenge/daily"
              className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-30px_var(--primary)] transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_25px_70px_-28px_var(--primary)]"
              onMouseEnter={() => convergenceRef.current?.pulse()}
              onFocus={() => convergenceRef.current?.pulse()}
              onClick={() => convergenceRef.current?.pulse()}
            >
              Engage Daily Duel
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="#playground"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
            >
              Build Your Challenge
              <Terminal className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {[
              "h j k l · move",
              "dd · delete line",
              "yy · yank",
              "/pattern · search",
              ":wq · save & quit",
            ].map((tip) => (
              <span
                key={tip}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md"
              >
                {tip}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Active models", value: "08" },
              { label: "Daily streak", value: "26 hrs" },
              { label: "Best human", value: "23 keys" },
            ].map((item) => (
              <div
                key={item.label}
                className="neon-card border border-white/10 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 font-display text-2xl text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-3xl bg-linear-to-tr from-primary/30 via-transparent to-accent/20 blur-2xl" />
          <div className="relative neon-card overflow-hidden rounded-3xl border border-white/10 bg-linear-to-b from-zinc-950/70 to-zinc-900/50 p-6 shadow-2xl">
            <div className="pointer-events-none absolute inset-0 grid-overlay opacity-20 mix-blend-soft-light" />
            <div className="pointer-events-none absolute left-6 top-10 h-4 w-3 rounded-[2px] bg-primary/90 shadow-[0_0_0_4px_rgba(16,185,129,0.14),0_0_18px_rgba(16,185,129,0.5)] animate-pulse" />
            <KeystrokeConvergence
              ref={convergenceRef}
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.95] mix-blend-screen"
            />
            <VimChrome className="z-10" />
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-12 rounded-full bg-linear-to-r from-primary to-accent" />
                  Live scoreboard
                </span>
                <span className="text-primary">00:12:44</span>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/40 p-4 backdrop-blur-md">
                {[
                  {
                    name: "Claude 3.5 Opus",
                    score: "18 keys",
                    accent: "from-emerald-400 to-emerald-500",
                  },
                  {
                    name: "GPT-4.1 Turbo",
                    score: "21 keys",
                    accent: "from-cyan-400 to-sky-500",
                  },
                  {
                    name: "You",
                    score: "?? keys",
                    accent: "from-amber-400 to-orange-500",
                  },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${row.accent} shadow-[0_0_18px_-4px_rgba(34,197,94,0.6)]`}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-linear-to-br from-white/10 to-white/5 text-xs font-bold uppercase text-foreground ring-1 ring-white/5" />
                        <div>
                          <p className="font-semibold text-white">{row.name}</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            Precision duel
                          </p>
                        </div>
                      </div>
                      <span className="font-display text-lg text-white">
                        {row.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-linear-to-r from-primary/10 to-accent/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Arena Mode
                  </p>
                  <p className="font-semibold text-white">
                    Blackout // 2x speed
                  </p>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  <div className="h-2 w-2 rounded-full bg-primary/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
