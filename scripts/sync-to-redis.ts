/**
 * Sync challenge-solutions.json and popular-challenges.json to Upstash Redis.
 *
 * Usage:
 *   KV_REST_API_URL=... KV_REST_API_TOKEN=... npx tsx scripts/sync-to-redis.ts
 *
 * Or if env vars are already in .env:
 *   npx tsx scripts/sync-to-redis.ts
 */

import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// Load .env manually since dotenv isn't installed
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
  }
}
import type { Challenge, RunResult } from "../src/lib/types";

const url =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error(
    "Missing Redis credentials. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN)"
  );
  process.exit(1);
}

const redis = new Redis({ url, token });

const SOLUTIONS_PATH = path.join(__dirname, "../data/challenge-solutions.json");
const CHALLENGES_PATH = path.join(__dirname, "../data/popular-challenges.json");

type SolutionMap = Record<string, Record<string, RunResult>>;

const solutions: SolutionMap = JSON.parse(
  fs.readFileSync(SOLUTIONS_PATH, "utf8")
);
const challenges: Challenge[] = JSON.parse(
  fs.readFileSync(CHALLENGES_PATH, "utf8")
);

function stripSteps(result: RunResult): RunResult {
  const { steps: _steps, ...rest } = result;
  return { ...rest, steps: [] };
}

async function main() {
  let resultCount = 0;
  let challengeCount = 0;
  let scoreCount = 0;

  // Sync challenges
  for (const challenge of challenges) {
    await redis.set(`challenge:${challenge.id}`, challenge);
    challengeCount++;

    if (
      typeof challenge.bestHumanScore === "number" &&
      challenge.bestHumanScore > 0 &&
      challenge.bestHumanScore < 999
    ) {
      await redis.set(`best:${challenge.id}`, challenge.bestHumanScore);
      scoreCount++;
    }
  }

  // Sync model results
  for (const [challengeId, models] of Object.entries(solutions)) {
    const payload: Record<string, RunResult> = {};
    for (const [modelId, result] of Object.entries(models)) {
      payload[modelId] = stripSteps(result);
      resultCount++;
    }
    if (Object.keys(payload).length > 0) {
      await redis.hset(`results:${challengeId}`, payload);
    }
  }

  console.log(
    `Synced ${challengeCount} challenges, ${scoreCount} best-human scores, ${resultCount} model results to Redis.`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
