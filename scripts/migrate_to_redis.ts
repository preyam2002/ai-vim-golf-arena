import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
// function to load env
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, "");
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.warn("Could not read .env file");
  }
}

loadEnv();

const DB_PATH = path.join(process.cwd(), "data", "db.json");

interface RunResult {
  modelId: string;
  steps: any[];
  // ... other fields
}

interface DB {
  dailyChallenges: Record<string, string>;
  results: Record<string, Record<string, RunResult>>;
  bestHumanScores: Record<string, number>;
  cachedChallenges: Record<string, any>;
}

function stripSteps(result: RunResult): RunResult {
  const { steps: _steps, ...rest } = result;
  return { ...rest, steps: [] };
}

async function main() {
  console.log("Starting migration to Redis...");

  // 1. Configure Redis
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error("❌ Missing Redis credentials. Please check your .env file.");
    console.error(
      "Required: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
    );
    process.exit(1);
  }

  const redis = new Redis({ url, token });

  // 2. Read local DB
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ db.json not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db: DB = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  console.log("✅ Loaded db.json");

  // 3. Migrate Daily Challenges
  const dailyEntries = Object.entries(db.dailyChallenges || {});
  if (dailyEntries.length > 0) {
    console.log(`Migrating ${dailyEntries.length} daily challenges...`);
    for (const [date, id] of dailyEntries) {
      await redis.set(`daily:${date}`, id);
    }
  }

  // 4. Migrate Best Human Scores
  const scoreEntries = Object.entries(db.bestHumanScores || {});
  if (scoreEntries.length > 0) {
    console.log(`Migrating ${scoreEntries.length} best human scores...`);
    for (const [id, score] of scoreEntries) {
      await redis.set(`best:${id}`, score);
    }
  }

  // 5. Migrate Cached Challenges
  const challengeEntries = Object.entries(db.cachedChallenges || {});
  if (challengeEntries.length > 0) {
    console.log(`Migrating ${challengeEntries.length} cached challenges...`);
    for (const [id, challenge] of challengeEntries) {
      await redis.set(`challenge:${id}`, challenge);
    }
  }

  // 6. Migrate Results
  const resultEntries = Object.entries(db.results || {});
  if (resultEntries.length > 0) {
    console.log(`Migrating results for ${resultEntries.length} challenges...`);
    for (const [challengeId, modelResults] of resultEntries) {
      const sanitizedResults: Record<string, RunResult> = {};
      for (const [modelId, result] of Object.entries(modelResults)) {
        sanitizedResults[modelId] = stripSteps(result);
      }

      if (Object.keys(sanitizedResults).length > 0) {
        await redis.hset(`results:${challengeId}`, sanitizedResults);
      }
    }
  }

  console.log("✅ Migration complete!");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
