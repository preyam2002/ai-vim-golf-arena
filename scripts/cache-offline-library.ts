import fs from "fs"
import path from "path"

import challenges from "../data/popular-challenges.json"
import existingSolutions from "../data/challenge-solutions.json"
import {
  availableModels,
  cleanKeystrokes,
  getGatewayCompletionsUrl,
} from "../src/lib/ai-gateway"
import { VimSimulator } from "../src/lib/vim-simulator"
import type { Challenge, RunResult } from "../src/lib/types"

type SolutionMap = Record<string, Record<string, RunResult>>

const SOLUTIONS_PATH = path.join(process.cwd(), "data", "challenge-solutions.json")
const MAX_CHALLENGES = Number.isFinite(Number.parseInt(process.env.MAX_CHALLENGES || ""))
  ? Number.parseInt(process.env.MAX_CHALLENGES || "100")
  : 100
const TARGET_MODELS =
  process.env.CACHE_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ||
  availableModels
    .filter((m) => m.id !== "user")
    .slice(0, 3) // keep the batch small by default
    .map((m) => m.id)
const FORCE_REFRESH = process.env.FORCE_REFRESH === "true"

async function main() {
  if (!process.env.AI_GATEWAY_URL || !process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_URL and AI_GATEWAY_API_KEY are required")
  }

  const solutionMap: SolutionMap = (existingSolutions as SolutionMap) || {}
  const challengeList = (challenges as Challenge[]).slice(0, MAX_CHALLENGES)

  console.log(
    `Caching up to ${challengeList.length} challenges for models: ${TARGET_MODELS.join(
      ", "
    )}${FORCE_REFRESH ? " (force refresh)" : ""}`
  )

  for (const challenge of challengeList) {
    solutionMap[challenge.id] ||= {}

    for (const modelId of TARGET_MODELS) {
      if (!FORCE_REFRESH && solutionMap[challenge.id][modelId]) {
        console.log(
          `[skip] ${challenge.id} already has cached result for ${modelId}`
        )
        continue
      }

      try {
        const result = await streamSolution(challenge, modelId)
        solutionMap[challenge.id][modelId] = result
        console.log(
          `[ok] ${challenge.id} (${modelId}) -> ${result.keystrokeCount} keys, ${
            result.timeMs
          }ms`
        )

        persistSolutions(solutionMap)
      } catch (error) {
        console.error(`[fail] ${challenge.id} (${modelId})`, error)
      }
    }
  }

  persistSolutions(solutionMap)
  console.log("Done.")
}

function persistSolutions(solutionMap: SolutionMap) {
  fs.writeFileSync(SOLUTIONS_PATH, JSON.stringify(solutionMap, null, 2))
}

async function streamSolution(challenge: Challenge, modelId: string): Promise<RunResult> {
  const prompt = `START TEXT:
\`\`\`
${challenge.startText}
\`\`\`

TARGET TEXT:
\`\`\`
${challenge.targetText}
\`\`\`

Output ONLY the Vim keystrokes to transform START into TARGET:`

  const response = await fetch(getGatewayCompletionsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: prompt },
      ],
      max_tokens: 10_000,
      temperature: 0.1,
      stream: true,
      stop: ["```"],
    }),
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`Gateway error ${response.status}: ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const tokenTimeline: { token: string; timestampMs: number }[] = []
  const startTime = Date.now()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === "[DONE]") {
        continue
      }

      try {
        const parsed = JSON.parse(payload)
        const content = parsed.choices?.[0]?.delta?.content
        const token =
          typeof content === "string"
            ? content
            : Array.isArray(content)
            ? content.join("")
            : ""
        if (!token) continue
        tokenTimeline.push({ token, timestampMs: Date.now() - startTime })
      } catch (error) {
        console.warn("Malformed chunk", payload, error)
      }
    }
  }

  const keystrokes = cleanKeystrokes(tokenTimeline.map((t) => t.token).join(""))
  const simulator = new VimSimulator(challenge.startText)
  simulator.executeKeystrokes(keystrokes)
  const finalText = simulator.getText()
  const steps = simulator.getSteps()

  const success = normalizeText(finalText) === normalizeText(challenge.targetText)
  const keystrokeCount = countKeystrokes(keystrokes)
  const timeMs = tokenTimeline.at(-1)?.timestampMs ?? 0

  return {
    modelId,
    modelName: modelId,
    keystrokes,
    keystrokeCount,
    timeMs,
    success,
    finalText,
    steps,
    diffFromBest: keystrokeCount - (challenge.bestHumanScore || 999),
    tokenTimeline,
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

function buildSystemPrompt() {
  return `You are an expert Vim golfer competing for the MINIMUM keystroke count. Every keystroke matters.

Output ONLY raw Vim keystrokes - no markdown, no quotes. Use <Esc>, <CR>, <BS> for special keys. Optimize for minimal keystrokes. Cursor starts at 0,0 in Normal mode.`
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

