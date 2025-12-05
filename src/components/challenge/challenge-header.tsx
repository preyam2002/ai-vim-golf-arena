import type { Challenge } from "@/lib/types"

interface ChallengeHeaderProps {
  challenge: Challenge
}

export function ChallengeHeader({ challenge }: ChallengeHeaderProps) {
  const isCustom = challenge.id === "custom" || challenge.bestHumanScore === 0

  return (
    <div className="border-b border-border bg-card/50 px-6 py-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{challenge.title}</h1>
            <p className="mt-1 text-muted-foreground">{challenge.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 px-4 py-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Best Human</div>
              <div className="text-2xl font-bold text-primary">{isCustom ? "N/A" : challenge.bestHumanScore}</div>
            </div>
            <div className="rounded-lg bg-muted px-4 py-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {isCustom ? "Type" : "Challenge ID"}
              </div>
              <div className="font-mono text-sm text-foreground">{isCustom ? "Custom" : challenge.id}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
