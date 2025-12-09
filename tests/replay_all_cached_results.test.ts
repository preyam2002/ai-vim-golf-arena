import fs from "fs"
import path from "path"
import { describe, it, expect } from "vitest"
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
} from "../src/lib/vim-engine"
import { staticChallenges } from "../src/lib/static-challenges"
import type { Challenge, RunResult } from "../src/lib/types"

type DbShape = {
  results: Record<string, Record<string, RunResult>>
  cachedChallenges: Record<string, Challenge>
}

const db: DbShape = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8")
)

const staticIndex = new Map(staticChallenges.map((c) => [c.id, c]))

function getChallenge(id: string): Challenge | null {
  if (staticIndex.has(id)) return staticIndex.get(id) ?? null
  return db.cachedChallenges[id] ?? null
}

function replay(startText: string, keystrokes: string): string {
  let state = createInitialState(startText)
  let remaining = keystrokes ?? ""
  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode)
    if (!stroke) break
    state = executeKeystroke(state, stroke)
    remaining = remaining.slice(stroke.length)
  }
  return state.lines.join("\n")
}

// NOTE: This suite is heavy across all cached runs and can exhaust memory.
// Keep skipped by default; run locally when needed to audit regressions.
describe.skip("replay all cached results against engine", () => {
  for (const [challengeId, models] of Object.entries(db.results)) {
    const ch = getChallenge(challengeId)
    if (!ch) continue

    const { startText, targetText } = ch
    const normTarget = normalizeText(targetText)

    describe(`challenge ${challengeId}`, () => {
      for (const [modelId, result] of Object.entries(models)) {
        it(`${modelId} matches target?`, () => {
          const finalText =
            result.finalText && result.finalText.length > 0
              ? result.finalText
              : replay(startText, result.keystrokes)
          const success = normalizeText(finalText) === normTarget
          // If engine says mismatch but DB marked success, that's an engine/data issue.
          // If engine says match but DB marked failure, flag mislabeling.
          expect(success).toBe(result.success)
        })
      }
    })
  }
})


