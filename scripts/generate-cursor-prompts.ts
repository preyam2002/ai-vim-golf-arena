#!/usr/bin/env npx ts-node
/**
 * Generate prompt files for manual model testing via Cursor / web chat interfaces.
 *
 * Usage:
 *   npx tsx scripts/generate-cursor-prompts.ts
 *
 * Output:
 *   data/cursor-prompts/index.json       — maps "01" → challengeId
 *   data/cursor-prompts/01-slug.txt      — full prompt per challenge
 *   data/cursor-prompts/COVERAGE.md      — what's cached, what's missing
 */

import fs from "fs";
import path from "path";

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

const MODEL_IDS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "gpt-5-4",
  "gpt-5-4-mini",
  "codex-5-3",
  "codex-5-2",
  "gemini-3-1-pro",
  "grok-4",
  "kimi-k2-5",
  "composer-2",
];

const PROMPTS_DIR = path.join(process.cwd(), "data", "cursor-prompts");

const SYSTEM_PROMPT = `You are an expert Vim golfer. Transform START into TARGET with the ABSOLUTE MINIMUM Vim keystrokes.

## REASONING (Think Step-by-Step)
1. Analyze: What changes are needed between START and TARGET?
2. Options: List 2-3 approaches (substitution, macros, ranges, etc.)
3. Count: Estimate keystrokes for each approach
4. Choose: Pick the approach with FEWEST keystrokes
5. Verify: Confirm your solution produces exact TARGET

## OUTPUT RULES (Strict)
- Output ONLY raw Vim keystrokes - NO markdown, NO explanation, NO code blocks
- Use notation: <Esc>, <CR>, <BS> for special keys
- Cursor starts at 0,0 in Normal mode
- First character must be a valid Vim keystroke

## EFFICIENCY PATTERNS
- :%s/old/new/g<CR> beats repeated cwfoo<Esc>
- :3,6d<CR> beats dddddd
- . (dot repeat) for repetitive edits
- Macros (q<reg>..q @<reg>) for complex repeats
- :g/pattern/d<CR> for multi-line deletes

Example valid outputs (plain text, nothing else):
- cwfoo<Esc>
- :%s/old/new/g<CR>
- ggdG`;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function main() {
  const solutionMap = existingSolutions as SolutionMap;
  const challengeList = challenges as Challenge[];

  // Clean output dir
  if (fs.existsSync(PROMPTS_DIR)) {
    for (const f of fs.readdirSync(PROMPTS_DIR)) {
      fs.unlinkSync(path.join(PROMPTS_DIR, f));
    }
  } else {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }

  const index: Record<string, { challengeId: string; title: string }> = {};
  const coverageLines: string[] = [];

  coverageLines.push("# Cache Coverage Report\n");
  coverageLines.push(`Generated: ${new Date().toISOString()}\n`);
  coverageLines.push(`Challenges: ${challengeList.length}`);
  coverageLines.push(`Models: ${MODEL_IDS.join(", ")}\n`);
  coverageLines.push("## How to use\n");
  coverageLines.push("1. Open a prompt file from `data/cursor-prompts/`");
  coverageLines.push("2. Copy everything below the `---` line");
  coverageLines.push("3. Paste into Cursor chat (or any model's web chat)");
  coverageLines.push("4. Copy the model's response (raw Vim keystrokes)");
  coverageLines.push("5. Save to `data/cursor-responses/{NUMBER}-{model-id}.txt`");
  coverageLines.push("   e.g., `01-gpt-4o.txt`, `01-claude-3.5-sonnet.txt`");
  coverageLines.push("6. Run `npx tsx scripts/import-cursor-responses.ts` to import\n");
  coverageLines.push("## Missing Solutions\n");

  let totalMissing = 0;

  for (let i = 0; i < challengeList.length; i++) {
    const challenge = challengeList[i];
    const num = String(i + 1).padStart(2, "0");
    const slug = slugify(challenge.title);
    const filename = `${num}-${slug}.txt`;

    index[num] = { challengeId: challenge.id, title: challenge.title };

    // Build the full prompt
    const userPrompt = [
      "START TEXT:",
      "```",
      challenge.startText,
      "```",
      "",
      "TARGET TEXT:",
      "```",
      challenge.targetText,
      "```",
      "",
      "Return ONLY the Vim keystrokes to transform START into TARGET.",
      "Do not include markdown, quotes, explanations, or extra lines.",
    ].join("\n");

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

    const header = [
      `# Challenge ${num}: ${challenge.title}`,
      `# ID: ${challenge.id}`,
      `# Best human score: ${challenge.bestHumanScore} keystrokes`,
      `#`,
      `# Copy everything below the --- line and paste into Cursor/chat.`,
      `# Time how long the model takes to respond.`,
      `# Save response to: data/cursor-responses/${num}-{model-id}.txt`,
      `#   e.g. ${num}-gpt-4o.txt, ${num}-claude-3.5-sonnet.txt`,
      `# First line of the file should be: time: <ms>  (e.g. "time: 3500")`,
      `# Second line onward: the model's raw keystroke response.`,
      `# ---`,
      ``,
    ].join("\n");

    fs.writeFileSync(path.join(PROMPTS_DIR, filename), header + fullPrompt);

    // Coverage per challenge
    const cached = MODEL_IDS.filter((m) => solutionMap[challenge.id]?.[m]);
    const missing = MODEL_IDS.filter((m) => !solutionMap[challenge.id]?.[m]);

    if (missing.length > 0) {
      coverageLines.push(`### ${num}. ${challenge.title}`);
      coverageLines.push(`Prompt: \`${filename}\``);
      if (cached.length > 0) {
        coverageLines.push(`Cached (${cached.length}): ${cached.join(", ")}`);
      }
      coverageLines.push(`**Missing (${missing.length})**: ${missing.join(", ")}\n`);
      totalMissing += missing.length;
    }
  }

  // Write index
  fs.writeFileSync(
    path.join(PROMPTS_DIR, "index.json"),
    JSON.stringify(index, null, 2) + "\n"
  );

  // Write coverage report
  const total = challengeList.length * MODEL_IDS.length;
  coverageLines.push("---\n");
  coverageLines.push(`**Total: ${total - totalMissing}/${total} cached, ${totalMissing} missing**`);
  fs.writeFileSync(
    path.join(PROMPTS_DIR, "COVERAGE.md"),
    coverageLines.join("\n") + "\n"
  );

  console.log(`Generated ${challengeList.length} prompt files in data/cursor-prompts/`);
  console.log(`Coverage: ${total - totalMissing}/${total} cached, ${totalMissing} missing`);
  console.log(`See data/cursor-prompts/COVERAGE.md for details`);
}

main();
