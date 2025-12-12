#!/usr/bin/env npx ts-node
/**
 * Migrate db.json results to use new model IDs matching availableModels
 * Also exports them to challenge-solutions.json
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model ID mapping: old format (with provider/) -> new format (just model id)
const MODEL_ID_MAP: Record<string, { id: string; name: string }> = {
  // OpenAI
  "openai/gpt-4o": { id: "gpt-4o", name: "GPT-4o" },
  "openai/gpt-4o-mini": { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  "openai/gpt-5": { id: "gpt-4o", name: "GPT-4o" },
  "openai/gpt-5-mini": { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  "openai/gpt-5-codex": { id: "gpt-4o", name: "GPT-4o" },
  "openai/o1": { id: "o1", name: "o1 (Reasoning)" },
  "openai/o3-mini": { id: "o3-mini", name: "o3 Mini (Reasoning)" },

  // Anthropic
  "anthropic/claude-sonnet-4.5": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-sonnet-4": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-3.5-sonnet": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-3.7-sonnet": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-haiku-4.5": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-3-opus": { id: "claude-3-opus", name: "Claude 3 Opus" },

  // Google
  "google/gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
  },
  "google/gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
  },
  "google/gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
  },

  // xAI
  "xai/grok-2": { id: "grok-2", name: "Grok 2" },
  "xai/grok-4-fast-reasoning": { id: "grok-2", name: "Grok 2" },
  "xai/grok-code-fast-1": { id: "grok-2", name: "Grok 2" },

  // DeepSeek
  "deepseek/deepseek-v3": { id: "deepseek-v3", name: "DeepSeek V3" },
  "deepseek/deepseek-r1": {
    id: "deepseek-r1",
    name: "DeepSeek R1 (Reasoning)",
  },

  // Mistral
  "mistral/mistral-large": { id: "mistral-large", name: "Mistral Large" },
  "mistral/mistral-large-latest": {
    id: "mistral-large",
    name: "Mistral Large",
  },

  // Additional variants found in db.json
  "openai/o3": { id: "o3-mini", name: "o3 Mini (Reasoning)" },
  "anthropic/claude-3-5-haiku-20241022": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-sonnet-4-20250514": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-3-5-sonnet-20241022": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic/claude-3-opus-20240229": {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
  },
  "google/gemini-2.0-flash-001": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
  },
  "deepseek/deepseek-chat": { id: "deepseek-v3", name: "DeepSeek V3" },
};

interface RunResult {
  modelId: string;
  modelName: string;
  keystrokes: string;
  keystrokeCount: number;
  timeMs: number;
  success: boolean;
  finalText: string;
  steps: unknown[];
  diffFromBest: number;
  tokenTimeline?: unknown[];
}

interface DB {
  dailyChallenges: Record<string, string>;
  results: Record<string, Record<string, RunResult>>;
  bestHumanScores: Record<string, number>;
  cachedChallenges: Record<string, unknown>;
}

type SolutionMap = Record<string, Record<string, RunResult>>;

async function main() {
  const dbPath = path.join(__dirname, "../data/db.json");
  const solutionsPath = path.join(
    __dirname,
    "../data/challenge-solutions.json"
  );

  // Read db.json
  const db: DB = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

  // Read existing challenge-solutions.json
  let solutions: SolutionMap = {};
  if (fs.existsSync(solutionsPath)) {
    try {
      solutions = JSON.parse(fs.readFileSync(solutionsPath, "utf-8"));
    } catch (e) {
      console.warn("Could not parse existing solutions, starting fresh");
    }
  }

  let migratedInDb = 0;
  let exportedToSolutions = 0;
  const unknownModels = new Set<string>();

  // Process each challenge's results
  for (const [challengeId, results] of Object.entries(db.results)) {
    const newResults: Record<string, RunResult> = {};

    for (const [oldModelId, result] of Object.entries(results)) {
      const mapping = MODEL_ID_MAP[oldModelId];

      if (!mapping) {
        // Keep as-is if already in new format or unknown
        if (!oldModelId.includes("/")) {
          // Already new format
          newResults[oldModelId] = result;
        } else {
          unknownModels.add(oldModelId);
          newResults[oldModelId] = result;
        }
        continue;
      }

      // Migrate to new format
      const newResult: RunResult = {
        ...result,
        modelId: mapping.id,
        modelName: mapping.name,
      };

      // Only keep first result for each new model ID (avoid duplicates)
      if (!newResults[mapping.id]) {
        newResults[mapping.id] = newResult;
        migratedInDb++;
      }
    }

    db.results[challengeId] = newResults;
  }

  // Also migrate challenge-solutions.json
  const newSolutions: SolutionMap = {};

  for (const [challengeId, results] of Object.entries(solutions)) {
    newSolutions[challengeId] = {};

    for (const [oldModelId, result] of Object.entries(results)) {
      const mapping = MODEL_ID_MAP[oldModelId];

      if (!mapping) {
        // Keep as-is if already new format, skip user/* and reference/* entries
        if (!oldModelId.includes("/") || oldModelId.startsWith("user/")) {
          newSolutions[challengeId][oldModelId] = result;
        } else if (oldModelId !== "reference/static") {
          unknownModels.add(oldModelId);
        }
        continue;
      }

      // Migrate to new format
      const { tokenTimeline, ...stripped } = result;
      const newResult = {
        ...stripped,
        modelId: mapping.id,
        modelName: mapping.name,
      };

      // Only keep first result for each new model ID
      if (!newSolutions[challengeId][mapping.id]) {
        newSolutions[challengeId][mapping.id] = newResult;
        exportedToSolutions++;
      }
    }
  }

  // Also add any results from db.json that aren't in solutions yet
  for (const [challengeId, results] of Object.entries(db.results)) {
    if (!newSolutions[challengeId]) {
      newSolutions[challengeId] = {};
    }

    for (const [modelId, result] of Object.entries(results)) {
      if (!newSolutions[challengeId][modelId] && !modelId.includes("/")) {
        const { tokenTimeline, ...stripped } = result;
        newSolutions[challengeId][modelId] = stripped;
        exportedToSolutions++;
      }
    }
  }

  // Write updated db.json
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + "\n");

  // Write updated challenge-solutions.json
  fs.writeFileSync(solutionsPath, JSON.stringify(newSolutions, null, 2) + "\n");

  console.log("\n--- Summary ---");
  console.log(`Migrated in db.json: ${migratedInDb}`);
  console.log(`Exported to challenge-solutions.json: ${exportedToSolutions}`);
  console.log(`Total challenges in db.json: ${Object.keys(db.results).length}`);
  console.log(
    `Total challenges in solutions: ${Object.keys(solutions).length}`
  );

  if (unknownModels.size > 0) {
    console.log(`\nUnknown model IDs (add to MODEL_ID_MAP):`);
    for (const m of unknownModels) {
      console.log(`  - ${m}`);
    }
  }
}

main().catch(console.error);
