import { type NextRequest, NextResponse } from "next/server"
import { callAIGateway, availableModels } from "@/lib/ai-gateway"
import { VimSimulator } from "@/lib/vim-simulator"
import type { RunResult } from "@/lib/types"
import {
  getOfflineSolution,
  hasOfflineSolution,
} from "@/lib/offline-library"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startText, targetText, modelIds, bestHumanScore, challengeId } = body

    if (!startText || !targetText || !modelIds || modelIds.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const results: RunResult[] = []
    const store = challengeId ? (await import("@/lib/store")).store : null
    const persistResult = async (result: RunResult) => {
      if (!store || !challengeId) return
      await store.saveResult(challengeId, result)
    }

    for (const modelId of modelIds) {
      const model = availableModels.find((m) => m.id === modelId)
      if (!model) continue

      const cached =
        challengeId && getOfflineSolution(challengeId as string, modelId)

      if (cached) {
        const keystrokeCount =
          cached.keystrokeCount || countKeystrokes(cached.keystrokes || "")
        const diffFromBest =
          typeof bestHumanScore === "number"
            ? keystrokeCount - bestHumanScore
            : cached.diffFromBest ?? 0

        const result: RunResult = {
          ...cached,
          modelName: cached.modelName || model.name,
          keystrokeCount,
          diffFromBest,
        }
        results.push(result)
        await persistResult(result)
        continue
      }

      const startTime = performance.now()

      try {
        const keystrokes = await callAIGateway(modelId, startText, targetText)
        const endTime = performance.now()

        const simulator = new VimSimulator(startText)
        simulator.executeKeystrokes(keystrokes)
        const finalText = simulator.getText()
        const steps = simulator.getSteps()

        const success = normalizeText(finalText) === normalizeText(targetText)
        const keystrokeCount = countKeystrokes(keystrokes)
        const diffFromBest = keystrokeCount - bestHumanScore

        const result: RunResult = {
          modelId,
          modelName: model.name,
          keystrokes,
          keystrokeCount,
          timeMs: Math.round(endTime - startTime),
          success,
          finalText,
          steps,
          diffFromBest,
        }
        results.push(result)
        await persistResult(result)
      } catch (error) {
        console.error(`Error running model ${modelId}:`, error)
        const result: RunResult = {
          modelId,
          modelName: model.name,
          keystrokes: "",
          keystrokeCount: 0,
          timeMs: 0,
          success: false,
          finalText: startText,
          steps: [],
          diffFromBest: 999,
        }
        results.push(result)
        await persistResult(result)
      }
    }

    results.sort((a, b) => {
      if (a.success !== b.success) return a.success ? -1 : 1
      if (a.keystrokeCount !== b.keystrokeCount) return a.keystrokeCount - b.keystrokeCount
      return a.timeMs - b.timeMs
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Run error:", error)
    return NextResponse.json({ error: "Failed to run challenge" }, { status: 500 })
  }
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim()
}

function countKeystrokes(keystrokes: string): number {
  let count = 0
  let i = 0
  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i)
      if (end !== -1) {
        count++
        i = end + 1
        continue
      }
    }
    count++
    i++
  }
  return count
}
