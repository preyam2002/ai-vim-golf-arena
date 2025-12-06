"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Shuffle, Terminal, Trophy, Calendar } from "lucide-react";
import type { Challenge } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const PAGE_SIZE = 9;

const formatBestScore = (bestHumanScore?: number) => {
  const valid =
    typeof bestHumanScore === "number" &&
    Number.isFinite(bestHumanScore) &&
    bestHumanScore > 0 &&
    bestHumanScore < 999;
  return valid ? `${bestHumanScore} keys` : "N/A";
};

export function ChallengeSelector() {
  const router = useRouter();
  const [challengeId, setChallengeId] = useState("");
  const [page, setPage] = useState(1);
  const [randomLoading, setRandomLoading] = useState(false);

  const { data, isValidating } = useSWR<{
    challenges: Challenge[];
    total: number;
    page: number;
    pageSize: number;
    totalPages?: number;
  }>(`/api/challenge?list=true&page=${page}&pageSize=${PAGE_SIZE}`, fetcher, {
    keepPreviousData: true, // avoid flicker/remount feel between pages
    revalidateOnFocus: false,
  });

  const currentPage = data?.page ?? page;
  const totalPages =
    data?.totalPages ??
    (data?.total
      ? Math.max(
          1,
          Math.ceil(data.total / (data.pageSize || PAGE_SIZE || 1))
        )
      : 1);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (challengeId.trim()) {
      router.push(`/challenge/${challengeId.trim()}`);
    }
  };

  const handleRandom = () => {
    setRandomLoading(true);
    const goFallback = () => router.push("/challenge/random");

    fetch("/api/challenge?id=random")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const randomId = data?.challenge?.id;
        if (typeof randomId === "string" && randomId.trim().length > 0) {
          router.push(`/challenge/${randomId}`);
          return;
        }
        goFallback();
      })
      .catch(() => {
        goFallback();
      })
      .finally(() => setRandomLoading(false));
  };

  const handleChallengeClick = (id: string) => {
    router.push(`/challenge/${id}`);
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const challenges = data?.challenges ?? [];

  return (
    <section
      id="playground"
      className="mx-auto flex w-full justify-center px-6 py-16 lg:px-10"
    >
      <div className="w-full max-w-5xl space-y-10 rounded-3xl border border-border bg-card p-10 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.85)] sm:p-12">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Play a challenge
          </p>
          <h2 className="font-display text-4xl text-white sm:text-5xl">
            Load a challenge or pick one
          </h2>
        </div>

        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-6 sm:flex-row sm:items-center sm:gap-5"
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
                className="block w-full rounded-xl border border-border bg-transparent py-4 pl-12 pr-4 text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <button
                type="submit"
                disabled={!challengeId.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Load
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRandom}
                disabled={randomLoading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-6 py-4 text-base font-semibold text-foreground transition-colors hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Shuffle className="h-4 w-4" />
                {randomLoading ? "Shuffling..." : "Random"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/challenge/daily")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-6 py-4 text-base font-semibold text-foreground transition-colors hover:bg-white/5"
              >
                <Calendar className="h-4 w-4" />
                Daily
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-xl text-white">
                <Trophy className="h-5 w-5 text-primary" />
                Featured challenges
              </h3>
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                curated
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {challenges.length === 0 ? (
                <p className="sm:col-span-2 md:col-span-3 text-sm text-muted-foreground">
                  {isValidating ? "Loading challenges..." : "No challenges found"}
                </p>
              ) : (
                challenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    onClick={() => handleChallengeClick(challenge.id)}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-background/60 p-4 text-left transition-colors hover:border-primary/60"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">
                        {challenge.title}
                      </h4>
                      <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                        {formatBestScore(challenge.bestHumanScore)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {challenge.description}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={!canGoPrev || isValidating}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-medium text-foreground transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!canGoNext || isValidating}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-medium text-foreground transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
