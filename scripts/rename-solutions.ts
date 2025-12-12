#!/usr/bin/env npx ts-node
/**
 * Rename cached solution files from old format to new format
 * Old: challengeId-provider_model.keys.txt
 * New: challengeId-modelId.keys.txt
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model ID mapping: old filename format -> new availableModels format
const MODEL_ID_MAP: Record<string, string> = {
  "openai_gpt-5-mini": "gpt-4o-mini",
  "openai_gpt-4o": "gpt-4o",
  openai_o1: "o1",
  "openai_o3-mini": "o3-mini",
  "anthropic_claude-sonnet-4.5": "claude-3.5-sonnet",
  "anthropic_claude-3.5-sonnet": "claude-3.5-sonnet",
  "anthropic_claude-3-opus": "claude-3-opus",
  "google_gemini-2.0-flash": "gemini-2.0-flash",
  "google_gemini-2.5-flash": "gemini-2.5-flash",
  "xai_grok-2": "grok-2",
  "xai_grok-4-fast-reasoning": "grok-2",
  "deepseek_deepseek-v3": "deepseek-v3",
  "deepseek_deepseek-r1": "deepseek-r1",
  "mistral_mistral-large-latest": "mistral-large",
  "mistral_mistral-large": "mistral-large",
};

function parseFilename(
  filename: string
): { challengeId: string; oldModelId: string } | null {
  const match = filename.match(/^([^-]+)-(.+)\.keys\.txt$/);
  if (!match) return null;
  return {
    challengeId: match[1],
    oldModelId: match[2],
  };
}

async function main() {
  const solutionsFullDir = path.join(__dirname, "../data/solutions-full");
  const files = fs
    .readdirSync(solutionsFullDir)
    .filter((f) => f.endsWith(".keys.txt"));

  console.log(`Found ${files.length} solution files`);

  let renamed = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      console.log(`Skipping unrecognized: ${file}`);
      skipped++;
      continue;
    }

    const { challengeId, oldModelId } = parsed;
    const newModelId = MODEL_ID_MAP[oldModelId];

    if (!newModelId) {
      console.log(`Unknown model ID, keeping as-is: ${oldModelId}`);
      skipped++;
      continue;
    }

    // Already in new format?
    if (oldModelId === newModelId) {
      console.log(`Already new format: ${file}`);
      skipped++;
      continue;
    }

    const oldPath = path.join(solutionsFullDir, file);
    const newFilename = `${challengeId}-${newModelId}.keys.txt`;
    const newPath = path.join(solutionsFullDir, newFilename);

    if (fs.existsSync(newPath)) {
      console.log(`Target exists, skipping: ${file} -> ${newFilename}`);
      skipped++;
      continue;
    }

    fs.renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} -> ${newFilename}`);
    renamed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Renamed: ${renamed}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(console.error);
