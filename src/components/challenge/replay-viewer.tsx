"use client"

import { useState, useEffect, useCallback } from "react"
import type { ReplayStep } from "@/lib/types"

interface ReplayViewerProps {
  steps: ReplayStep[]
  modelName: string
  keystrokes: string
}

export function ReplayViewer({ steps, modelName, keystrokes }: ReplayViewerProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(500)

  const step = steps[currentStep]

  const play = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0)
    }
    setIsPlaying(true)
  }, [currentStep, steps.length])

  const pause = () => setIsPlaying(false)
  const reset = () => {
    setIsPlaying(false)
    setCurrentStep(0)
  }

  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, speed)

    return () => clearInterval(timer)
  }, [isPlaying, speed, steps.length])

  if (!steps.length) return null

  const lines = step?.text.split("\n") || []

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <span className="font-medium text-foreground">Replay: {modelName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {currentStep + 1} / {steps.length}
          </span>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{step?.mode}</span>
        </div>
      </div>

      <div className="border-b border-border p-4">
        <div className="mb-2 text-xs text-muted-foreground">Keystrokes:</div>
        <div className="flex flex-wrap gap-1 font-mono text-sm">
          {keystrokes.split("").map((char, i) => {
            const isPast = i < getCurrentKeystrokeIndex(steps, currentStep, keystrokes)
            return (
              <span
                key={i}
                className={`rounded px-1 ${isPast ? "bg-sky-500/15 text-sky-300" : "bg-white/5 text-muted-foreground"}`}
              >
                {char}
              </span>
            )
          })}
        </div>
      </div>

      <div className="overflow-auto max-h-64">
        <pre className="p-4 font-mono text-sm">
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} className="flex">
              <span className="mr-4 w-8 select-none text-right text-muted-foreground">{lineIdx + 1}</span>
              <span className="flex-1">
                {line.split("").map((char, colIdx) => {
                  const isCursor = step?.cursorLine === lineIdx && step?.cursorCol === colIdx
                  return (
                    <span key={colIdx} className={isCursor ? "bg-primary text-primary-foreground" : ""}>
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

      <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? pause : play}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={reset}
            className="rounded-md bg-white/5 px-4 py-1.5 text-sm font-medium text-foreground border border-white/10 hover:border-primary/50 hover:text-primary"
          >
            Reset
          </button>
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="rounded-md bg-white/5 px-3 py-1.5 text-sm font-medium text-foreground border border-white/10 hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep >= steps.length - 1}
            className="rounded-md bg-white/5 px-3 py-1.5 text-sm font-medium text-foreground border border-white/10 hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Speed:</label>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            <option value={1000}>Slow</option>
            <option value={500}>Normal</option>
            <option value={200}>Fast</option>
            <option value={50}>Very Fast</option>
          </select>
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Current keystroke: <span className="font-mono font-medium text-foreground">{step?.keystroke || "START"}</span>
      </div>
    </div>
  )
}

function getCurrentKeystrokeIndex(steps: ReplayStep[], currentStep: number, keystrokes: string): number {
  let totalChars = 0
  for (let i = 1; i <= currentStep && i < steps.length; i++) {
    const ks = steps[i]?.keystroke || ""
    totalChars += ks.length
  }
  return Math.min(totalChars, keystrokes.length)
}
