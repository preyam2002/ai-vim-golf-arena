"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowRight,
  Shuffle,
  Terminal,
  PenLine,
  Trophy,
  Calendar,
} from "lucide-react";
import type { Challenge } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ChallengeSelector() {
  const router = useRouter();
  const [challengeId, setChallengeId] = useState("");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [customStartText, setCustomStartText] = useState("");
  const [customTargetText, setCustomTargetText] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const { data } = useSWR<{ challenges: Challenge[] }>(
    "/api/challenge?list=true",
    fetcher
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (challengeId.trim()) {
      router.push(`/challenge/${challengeId.trim()}`);
    }
  };

  const handleRandom = () => {
    router.push("/challenge/random");
  };

  const handleChallengeClick = (id: string) => {
    router.push(`/challenge/${id}`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartText.trim() && customTargetText.trim()) {
      const customChallenge = {
        startText: customStartText,
        targetText: customTargetText,
        title: customTitle.trim() || "Custom Challenge",
      };
      const encoded = encodeURIComponent(JSON.stringify(customChallenge));
      router.push(`/challenge/custom?data=${encoded}`);
    }
  };

  return (
    <section
      id="playground"
      className="mx-auto max-w-5xl px-6 pb-24 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-950/80 via-zinc-900/70 to-zinc-950/70 p-3 shadow-[0_40px_80px_-60px_rgba(0,0,0,1)]">
        <div className="absolute inset-px rounded-[24px] border border-white/5" />
        <div className="absolute inset-0 opacity-30 blur-3xl">
          <div className="grid-overlay h-full w-full" />
        </div>

        <div className="relative space-y-8 rounded-[22px] border border-white/5 bg-black/40 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Configure the duel
            </div>
            <div className="flex gap-2">
              {[
                { key: "preset", label: "Challenges", icon: Trophy },
                { key: "custom", label: "Custom", icon: PenLine },
              ].map((item) => {
                const Icon = item.icon;
                const active = mode === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setMode(item.key as typeof mode)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "border-primary/70 bg-primary/20 text-white shadow-[0_10px_35px_-22px_var(--primary)]"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={() => router.push("/challenge/daily")}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary"
              >
                <Calendar className="h-4 w-4" />
                Daily
              </button>
            </div>
          </div>

          {mode === "preset" ? (
            <div className="space-y-8">
              <div className="neon-card border border-white/10 p-6">
                <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Load a VimGolf match
                  </span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                    Instant fetch
                  </span>
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4 sm:flex-row"
                >
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Terminal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      value={challengeId}
                      onChange={(e) => setChallengeId(e.target.value)}
                      placeholder="Enter VimGolf challenge ID"
                      className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-foreground shadow-inner shadow-black/20 placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!challengeId.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[0_15px_50px_-28px_var(--primary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_50px_-20px_var(--primary)] disabled:translate-y-0 disabled:opacity-50"
                  >
                    Load
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRandom}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-foreground transition-all hover:border-primary/40 hover:text-primary"
                  >
                    <Shuffle className="h-4 w-4" />
                    Random
                  </button>
                </form>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-xl text-white">
                    <Trophy className="h-5 w-5 text-primary" />
                    Featured duels
                  </h2>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    curated rotation
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data?.challenges?.map((challenge, idx) => (
                    <button
                      key={challenge.id}
                      onClick={() => handleChallengeClick(challenge.id)}
                      className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_25px_70px_-50px_var(--primary)]"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                      <div className="flex w-full items-start justify-between">
                        <h3 className="font-semibold text-white transition-colors group-hover:text-primary">
                          {challenge.title}
                        </h3>
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                          {challenge.bestHumanScore} keys
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {challenge.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="neon-card border border-white/10 p-6">
              <div className="mb-6 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>Create your own arena</span>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold text-accent">
                  freestyle
                </span>
              </div>
              <form
                onSubmit={handleCustomSubmit}
                className="flex flex-col gap-6"
              >
                <div>
                  <label
                    htmlFor="custom-title"
                    className="mb-2 block text-sm font-semibold text-foreground"
                  >
                    Challenge title
                  </label>
                  <input
                    id="custom-title"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Blackout remix"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="start-text"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Initial text <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="start-text"
                      value={customStartText}
                      onChange={(e) => setCustomStartText(e.target.value)}
                      placeholder="Enter the starting text..."
                      rows={8}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="target-text"
                      className="mb-2 block text-sm font-semibold text-foreground"
                    >
                      Target text <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="target-text"
                      value={customTargetText}
                      onChange={(e) => setCustomTargetText(e.target.value)}
                      placeholder="Enter the target text..."
                      rows={8}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!customStartText.trim() || !customTargetText.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3 font-semibold text-primary-foreground shadow-[0_20px_60px_-30px_var(--primary)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_25px_70px_-28px_var(--primary)] disabled:translate-y-0 disabled:opacity-50"
                >
                  Start custom challenge
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
