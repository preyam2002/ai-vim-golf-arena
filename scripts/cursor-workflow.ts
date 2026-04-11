#!/usr/bin/env npx tsx
/**
 * Interactive CLI for the Cursor-based model testing workflow.
 *
 * Usage:
 *   npx tsx scripts/cursor-workflow.ts <model-id> [challenge-numbers...]
 *
 * Examples:
 *   npx tsx scripts/cursor-workflow.ts claude-opus-4-6          # all missing challenges
 *   npx tsx scripts/cursor-workflow.ts claude-opus-4-6 01 02 03 # specific challenges
 *
 * Flow per challenge:
 *   1. Copies the prompt to your clipboard
 *   2. You paste it into Cursor (or any chat) with the target model selected
 *   3. Press ENTER here once the model STARTS generating
 *   4. Press ENTER again once the model FINISHES
 *   5. Paste the model's response, then press ENTER on an empty line
 *   6. Script saves the response with real measured time
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";

import challenges from "../data/popular-challenges.json";
import existingSolutions from "../data/challenge-solutions.json";

interface Challenge {
  id: string;
  title: string;
  startText: string;
  targetText: string;
  bestHumanScore: number;
}

type SolutionMap = Record<string, Record<string, unknown>>;

const PROMPTS_DIR = path.join(process.cwd(), "data", "cursor-prompts");
const RESPONSES_DIR = path.join(process.cwd(), "data", "cursor-responses");
const INDEX_PATH = path.join(PROMPTS_DIR, "index.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function readMultiline(prompt: string): Promise<string> {
  console.log(prompt);
  const lines: string[] = [];
  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (line === "" && lines.length > 0) {
        rl.removeListener("line", handler);
        resolve(lines.join("\n"));
      } else {
        lines.push(line);
      }
    };
    rl.on("line", handler);
  });
}

function copyToClipboard(text: string): boolean {
  try {
    execSync("pbcopy", { input: text });
    return true;
  } catch {
    try {
      execSync("xclip -selection clipboard", { input: text });
      return true;
    } catch {
      return false;
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: npx tsx scripts/cursor-workflow.ts <model-id> [challenge-numbers...]");
    console.log("       npx tsx scripts/cursor-workflow.ts claude-opus-4-6");
    console.log("       npx tsx scripts/cursor-workflow.ts gpt-4o 01 02 03");
    process.exit(1);
  }

  const modelId = args[0];
  const requestedNums = args.slice(1);

  if (!fs.existsSync(INDEX_PATH)) {
    console.log("Run generate-cursor-prompts.ts first.");
    process.exit(1);
  }

  const index: Record<string, { challengeId: string; title: string }> = JSON.parse(
    fs.readFileSync(INDEX_PATH, "utf-8")
  );
  const solutionMap = existingSolutions as SolutionMap;
  const challengeList = challenges as Challenge[];

  // Determine which challenges to run
  let nums: string[];
  if (requestedNums.length > 0) {
    nums = requestedNums.map((n) => n.padStart(2, "0"));
  } else {
    // Find all challenges missing this model
    nums = [];
    for (let i = 0; i < challengeList.length; i++) {
      const num = String(i + 1).padStart(2, "0");
      const entry = index[num];
      if (entry && !solutionMap[entry.challengeId]?.[modelId]) {
        nums.push(num);
      }
    }
  }

  if (nums.length === 0) {
    console.log(`No missing challenges for ${modelId}.`);
    process.exit(0);
  }

  fs.mkdirSync(RESPONSES_DIR, { recursive: true });

  console.log(`\nModel: ${modelId}`);
  console.log(`Challenges: ${nums.length} to process\n`);
  console.log("=".repeat(60));

  runLoop(modelId, nums, index);
}

async function runLoop(
  modelId: string,
  nums: string[],
  index: Record<string, { challengeId: string; title: string }>
) {
  let completed = 0;

  for (const num of nums) {
    const entry = index[num];
    if (!entry) {
      console.log(`[skip] No challenge for number ${num}`);
      continue;
    }

    console.log(`\n--- Challenge ${num}: ${entry.title} ---`);

    // Read and copy prompt
    const promptFiles = fs.readdirSync(PROMPTS_DIR).filter((f) => f.startsWith(`${num}-`) && f.endsWith(".txt"));
    if (promptFiles.length === 0) {
      console.log("[skip] No prompt file found");
      continue;
    }

    const promptContent = fs.readFileSync(path.join(PROMPTS_DIR, promptFiles[0]), "utf-8");
    // Extract everything after the --- line
    const prompt = promptContent.split("# ---\n").slice(1).join("# ---\n");

    const copied = copyToClipboard(prompt);
    if (copied) {
      console.log("Prompt copied to clipboard.");
    } else {
      console.log("Could not copy to clipboard. Prompt file:", promptFiles[0]);
    }

    console.log("Paste it into Cursor with the model selected.\n");

    await ask("Press ENTER when the model STARTS responding...");
    const startTime = Date.now();

    await ask("Press ENTER when the model FINISHES responding...");
    const elapsed = Date.now() - startTime;

    console.log(`Measured time: ${elapsed}ms`);

    const response = await readMultiline(
      "Paste the model's response below, then press ENTER on an empty line:"
    );

    if (!response.trim()) {
      console.log("[skip] Empty response");
      continue;
    }

    // Save response file
    const filename = `${num}-${modelId}.txt`;
    const content = `time: ${elapsed}\n${response}`;
    fs.writeFileSync(path.join(RESPONSES_DIR, filename), content);
    console.log(`Saved: ${filename} (${elapsed}ms)`);
    completed++;

    if (nums.indexOf(num) < nums.length - 1) {
      const cont = await ask("\nContinue to next challenge? (y/n) ");
      if (cont.toLowerCase() === "n") break;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done. ${completed} responses saved to data/cursor-responses/`);
  console.log(`Run: npx tsx scripts/import-cursor-responses.ts`);
  rl.close();
}

main();
