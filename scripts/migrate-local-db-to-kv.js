/* eslint-env node */
/* eslint-disable no-undef */
const fs = require("fs");
const path = require("path");
const { Redis } = require("@upstash/redis");

const DB_PATH = path.join(process.cwd(), "data", "db.json");

const redisConfig =
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }) ||
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN && {
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

async function main() {
  if (!redisConfig) {
    console.error(
      "Missing Upstash Redis env vars (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN). Aborting migration."
    );
    process.exit(1);
  }

  const redis = new Redis(redisConfig);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Local DB not found at ${DB_PATH}. Nothing to migrate.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(raw);

  const dailyEntries = Object.entries(db.dailyChallenges || {});
  const resultEntries = Object.entries(db.results || {});
  const bestHumanEntries = Object.entries(db.bestHumanScores || {});

  let dailyCount = 0;
  let resultCount = 0;
  let bestHumanCount = 0;

  for (const [date, challengeId] of dailyEntries) {
    await redis.set(`daily:${date}`, challengeId);
    dailyCount += 1;
  }

  for (const [challengeId, results] of resultEntries) {
    if (results && Object.keys(results).length > 0) {
      await redis.hset(`results:${challengeId}`, results);
      resultCount += Object.keys(results).length;
    } else {
      await redis.hset(`results:${challengeId}`, {});
    }
  }

  for (const [challengeId, bestHumanScore] of bestHumanEntries) {
    if (Number.isFinite(bestHumanScore)) {
      await redis.set(`best:${challengeId}`, bestHumanScore);
      bestHumanCount += 1;
    }
  }

  console.log(
    `Migrated ${dailyCount} daily challenge entries, ${resultCount} results across ${resultEntries.length} challenges, and ${bestHumanCount} best human scores.`
  );
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

