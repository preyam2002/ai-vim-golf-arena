#!/usr/bin/env npx ts-node
/**
 * Import cached solutions from /data/solutions-full/ into challenge-solutions.json
 * Maps old model IDs to new model IDs from availableModels
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model ID mapping: old filename format -> new availableModels format
const MODEL_ID_MAP: Record<string, { id: string; name: string }> = {
  "openai_gpt-5-mini": { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  "openai_gpt-4o": { id: "gpt-4o", name: "GPT-4o" },
  openai_o1: { id: "o1", name: "o1 (Reasoning)" },
  "openai_o3-mini": { id: "o3-mini", name: "o3 Mini (Reasoning)" },
  "anthropic_claude-sonnet-4.5": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic_claude-3.5-sonnet": {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
  },
  "anthropic_claude-3-opus": { id: "claude-3-opus", name: "Claude 3 Opus" },
  "google_gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
  },
  "google_gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
  },
  "xai_grok-2": { id: "grok-2", name: "Grok 2" },
  "xai_grok-4-fast-reasoning": { id: "grok-2", name: "Grok 2" }, // Map old grok-4 to grok-2
  "deepseek_deepseek-v3": { id: "deepseek-v3", name: "DeepSeek V3" },
  "deepseek_deepseek-r1": {
    id: "deepseek-r1",
    name: "DeepSeek R1 (Reasoning)",
  },
  "mistral_mistral-large-latest": {
    id: "mistral-large",
    name: "Mistral Large",
  },
  "mistral_mistral-large": { id: "mistral-large", name: "Mistral Large" },
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
}

type SolutionMap = Record<string, Record<string, RunResult>>;

function countKeystrokes(keystrokes: string): number {
  // Simple keystroke counting - matches the countKeystrokes in vim-engine
  let count = 0;
  let i = 0;
  while (i < keystrokes.length) {
    // Check for special key notation like <Esc>, <CR>, etc.
    if (keystrokes[i] === "<") {
      const closeIdx = keystrokes.indexOf(">", i);
      if (closeIdx !== -1) {
        count++;
        i = closeIdx + 1;
        continue;
      }
    }
    count++;
    i++;
  }
  return count;
}

function parseFilename(
  filename: string
): { challengeId: string; oldModelId: string } | null {
  // Pattern: challengeId-provider_model.keys.txt
  const match = filename.match(/^([^-]+)-(.+)\.keys\.txt$/);
  if (!match) return null;
  return {
    challengeId: match[1],
    oldModelId: match[2],
  };
}

async function main() {
  const solutionsFullDir = path.join(__dirname, "../data/solutions-full");
  const outputFile = path.join(__dirname, "../data/challenge-solutions.json");

  // Load existing solutions
  let existingSolutions: SolutionMap = {};
  if (fs.existsSync(outputFile)) {
    try {
      existingSolutions = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
    } catch (e) {
      console.warn(
        "Could not parse existing challenge-solutions.json, starting fresh"
      );
    }
  }

  // Read all .keys.txt files
  const files = fs
    .readdirSync(solutionsFullDir)
    .filter((f) => f.endsWith(".keys.txt"));
  console.log(`Found ${files.length} solution files`);

  let imported = 0;
  let skipped = 0;
  const unknownModels = new Set<string>();

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      console.warn(`Skipping unrecognized filename format: ${file}`);
      skipped++;
      continue;
    }

    const { challengeId, oldModelId } = parsed;
    const modelMapping = MODEL_ID_MAP[oldModelId];

    if (!modelMapping) {
      unknownModels.add(oldModelId);
      skipped++;
      continue;
    }

    // Read the keystrokes from the file
    const filePath = path.join(solutionsFullDir, file);
    const keystrokes = fs.readFileSync(filePath, "utf-8").trim();

    // Skip empty or suspiciously large files (likely errors)
    if (!keystrokes || keystrokes.length > 1000) {
      console.warn(
        `Skipping ${file}: empty or suspicious content (${keystrokes.length} chars)`
      );
      skipped++;
      continue;
    }

    // Create the RunResult
    const result: RunResult = {
      modelId: modelMapping.id,
      modelName: modelMapping.name,
      keystrokes,
      keystrokeCount: countKeystrokes(keystrokes),
      timeMs: 0,
      success: false, // Will be re-evaluated at runtime
      finalText: "", // Will be computed at runtime
      steps: [],
      diffFromBest: 0,
    };

    // Add to solutions map
    if (!existingSolutions[challengeId]) {
      existingSolutions[challengeId] = {};
    }

    // Don't overwrite existing solutions (prefer already-verified data)
    if (!existingSolutions[challengeId][modelMapping.id]) {
      existingSolutions[challengeId][modelMapping.id] = result;
      imported++;
      console.log(
        `Imported: ${challengeId} / ${modelMapping.id} (${keystrokes.length} chars)`
      );
    } else {
      console.log(`Skipping existing: ${challengeId} / ${modelMapping.id}`);
      skipped++;
    }
  }

  // Write updated solutions
  fs.writeFileSync(
    outputFile,
    JSON.stringify(existingSolutions, null, 2) + "\n"
  );

  console.log("\n--- Summary ---");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total challenges: ${Object.keys(existingSolutions).length}`);

  if (unknownModels.size > 0) {
    console.log(`\nUnknown model IDs (add to MODEL_ID_MAP):`);
    for (const m of unknownModels) {
      console.log(`  - ${m}`);
    }
  }
}

main().catch(console.error);
