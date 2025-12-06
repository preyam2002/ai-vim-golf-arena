import type { RunResult } from "@/lib/types"

const isInProgressStatus = (status?: RunResult["status"]) =>
  status === "in-progress" || status === "verifying" || status === "pending"

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

  const status = result.status ?? (result.success ? "complete" : "failed")
  const renderStatusBadge = () => {
    if (status === "in-progress" || status === "pending") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">In progress</span>
    }
    if (status === "verifying") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">Verifying</span>
    }
    if (status === "aborted") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-200">Aborted</span>
    }
    if (status === "error") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-200">Error</span>
    }
    if (status === "failed") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-200">Failed</span>
    }
    return <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-200">Success</span>
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">{result.modelName} Details</h3>
        {renderStatusBadge()}
      </div>
      <div className="p-4">
        {isInProgressStatus(status) && (
          <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Model is still running—stats will keep updating as keystrokes arrive.
          </div>
        )}
        {status === "aborted" && (
          <div className="mb-4 rounded-lg border border-dashed border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            Run was aborted before completion.
          </div>
        )}
        {status === "error" && (
          <div className="mb-4 rounded-lg border border-dashed border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            Run failed due to an error; retry the model to view full stats.
          </div>
        )}
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
