"use client"

import { useState, useEffect, useRef } from "react"
import type { ReplayStep } from "@/lib/types"

interface LiveSimulatorProps {
  modelName: string
  modelId: string
  steps: ReplayStep[]
  keystrokes: string
  isComplete: boolean
  success: boolean
  autoPlay?: boolean
  playSpeed?: number
}

export function LiveSimulator({
  modelName,
  modelId,
  steps,
  keystrokes,
  isComplete,
  success,
  autoPlay = true,
  playSpeed = 150,
}: LiveSimulatorProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return

    animationRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          if (isComplete) {
            setIsPlaying(false)
          }
          return prev
        }
        return prev + 1
      })
    }, playSpeed)

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [isPlaying, steps.length, isComplete, playSpeed])

  useEffect(() => {
    if (steps.length === 1) {
      setCurrentStep(0)
      setIsPlaying(autoPlay)
    }
  }, [steps.length, autoPlay])

  const step = steps[currentStep] || steps[0]
  const lines = step?.text.split("\n") || [""]

  // Calculate which keystrokes have been executed
  const executedKeystrokes = steps
    .slice(1, currentStep + 1)
    .map((s) => s.keystroke)
    .join("")

  return (
    <div className="neon-card flex flex-col rounded-2xl border border-white/10 bg-black/50 overflow-hidden h-full backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-white/5 via-black/40 to-black/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-white truncate max-w-[140px]">{modelName}</span>
          {isComplete && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded border ${
                success ? "bg-sky-500/15 text-sky-200 border-sky-500/30" : "bg-rose-500/15 text-rose-300 border-rose-400/30"
              }`}
            >
              {success ? "Success" : "Failed"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {currentStep}/{steps.length - 1}
          </span>
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {step?.mode || "normal"}
          </span>
        </div>
      </div>

      {/* Keystrokes display */}
      <div className="border-b border-white/10 px-3 py-2 bg-black/40">
        <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-[0.18em]">Keystrokes</div>
        <div className="flex flex-wrap gap-1 font-mono text-[11px] max-h-14 overflow-y-auto">
          {tokenizeKeystrokes(keystrokes).map((token, i) => {
            const executedTokens = tokenizeKeystrokes(executedKeystrokes)
            const isExecuted = i < executedTokens.length
            const isCurrent = i === executedTokens.length - 1
            return (
              <span
                key={i}
                className={`rounded-lg px-1.5 py-0.5 border ${
                  isCurrent
                    ? "bg-primary/20 text-primary border-primary/50"
                    : isExecuted
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-white/5 text-muted-foreground border-white/10"
                }`}
              >
                {formatToken(token)}
              </span>
            )
          })}
          {!isComplete && <span className="animate-pulse text-muted-foreground">...</span>}
        </div>
      </div>

      {/* Editor view */}
      <div className="flex-1 overflow-auto min-h-[140px] max-h-[220px] bg-black/60">
        <pre className="p-3 font-mono text-[11px] leading-relaxed">
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} className="flex">
              <span className="mr-3 w-6 select-none text-right text-muted-foreground/60">{lineIdx + 1}</span>
              <span className="flex-1 whitespace-pre">
                {line.split("").map((char, colIdx) => {
                  const isCursor = step?.cursorLine === lineIdx && step?.cursorCol === colIdx
                  return (
                    <span key={colIdx} className={isCursor ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]" : ""}>
                      {char}
                    </span>
                  )
                })}
                {step?.cursorLine === lineIdx && step?.cursorCol === line.length && (
                  <span className="bg-primary text-primary-foreground"> </span>
                )}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!isComplete && currentStep >= steps.length - 1}
            className="rounded-lg border border-white/10 bg-primary/90 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_12px_40px_-28px_var(--primary)] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => {
              setCurrentStep(0)
              setIsPlaying(true)
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
          >
            Restart
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            ←
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep >= steps.length - 1}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

function tokenizeKeystrokes(keystrokes: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i)
      if (end !== -1) {
        tokens.push(keystrokes.slice(i, end + 1))
        i = end + 1
        continue
      }
    }
    if (keystrokes[i] === ":" && i > 0) {
      const crIdx = keystrokes.indexOf("<CR>", i)
      if (crIdx !== -1) {
        tokens.push(keystrokes.slice(i, crIdx + 4))
        i = crIdx + 4
        continue
      }
    }
    tokens.push(keystrokes[i])
    i++
  }
  return tokens
}

function formatToken(token: string): string {
  if (token === " ") return "␣"
  if (token === "\n") return "↵"
  if (token === "\t") return "⇥"
  return token
}
