"use client";

import Link from "next/link";
import { ArrowUpRight, Terminal } from "lucide-react";

export function HeroSection() {
  return (
    <section className="px-6 pt-14 pb-16 lg:px-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Vimgolf AI Arena
          </p>
          <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
            Minimal challenges. Pure keystrokes.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Jump into the daily or load a specific VimGolf challenge. No panels
            or extras—just the controls to start.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/challenge/daily"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
            >
              Play the daily
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="#playground"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-white/5"
            >
              Build a challenge
              <Terminal className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
