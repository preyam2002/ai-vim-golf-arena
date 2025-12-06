import type { ReactNode } from "react";
import type { Challenge } from "@/lib/types";

interface ChallengeHeaderProps {
  challenge: Challenge;
  ctaSlot?: ReactNode;
}

function formatBestScore(bestHumanScore?: number) {
  const valid =
    typeof bestHumanScore === "number" &&
    Number.isFinite(bestHumanScore) &&
    bestHumanScore > 0 &&
    bestHumanScore < 999;
  return valid ? `${bestHumanScore}` : "N/A";
}

export function ChallengeHeader({ challenge, ctaSlot }: ChallengeHeaderProps) {
  const isCustom = challenge.id === "custom" || challenge.bestHumanScore === 0;
  const bestScoreLabel = formatBestScore(challenge.bestHumanScore);

  return (
    <div className="border-b border-border bg-card/50 px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="min-w-[200px]">
            <h1 className="text-2xl font-bold text-foreground">
              {challenge.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {challenge.description}
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-4">
            {ctaSlot && <div className="order-2 sm:order-1">{ctaSlot}</div>}
            <div className="flex flex-row items-center gap-4 order-1 sm:order-2">
              <div className="rounded-lg bg-primary/10 px-4 py-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Best Human
                </div>
                <div className="text-2xl font-bold text-primary">
                  {isCustom ? "N/A" : bestScoreLabel}
                </div>
              </div>
              <div className="rounded-lg bg-muted px-4 py-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {isCustom ? "Type" : "Challenge ID"}
                </div>
                <div className="font-mono text-sm text-foreground">
                  {isCustom ? "Custom" : challenge.id}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
