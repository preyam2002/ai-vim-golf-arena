import type { RunResult } from "@/lib/types"

interface StatsPanelProps {
  result: RunResult | null
}

export function StatsPanel({ result }: StatsPanelProps) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
        <div className="text-muted-foreground">Select a model result to view details</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">{result.modelName} Details</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Keystrokes"
            value={result.keystrokeCount.toString()}
            subtext={`${result.diffFromBest >= 0 ? "+" : ""}${result.diffFromBest} vs human`}
          />
          <StatCard label="Time" value={`${result.timeMs}ms`} subtext="API response time" />
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-foreground">Generated Keystrokes:</div>
          <div className="rounded-md bg-muted p-3 font-mono text-sm break-all">{result.keystrokes || "(empty)"}</div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
            <span>Final Output:</span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                result.success ? "bg-sky-500/10 text-sky-300" : "bg-rose-500/10 text-rose-300"
              }`}
            >
              {result.success ? "Matches Target" : "Does Not Match"}
            </span>
          </div>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-sm">{result.finalText}</pre>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{subtext}</div>
    </div>
  )
}
