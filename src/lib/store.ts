import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { Challenge, RunResult } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

interface DB {
  dailyChallenges: Record<string, string>; // date (YYYY-MM-DD) -> challengeId
  results: Record<string, Record<string, RunResult>>; // challengeId -> modelId -> RunResult
  bestHumanScores: Record<string, number>; // challengeId -> best human keystroke count
  cachedChallenges: Record<string, Challenge>; // challengeId -> Challenge payload
}

// Feature flag: opt into Redis via USE_REDIS=true. Defaults to file-backed db.json.
const enableRedis = process.env.USE_REDIS === "true";

const redisConfig =
  enableRedis &&
  ((process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN && {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) ||
    (process.env.KV_REST_API_URL &&
      process.env.KV_REST_API_TOKEN && {
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      }));

const redis = redisConfig ? new Redis(redisConfig) : null;
const useRedis = !!redis;

function ensureDb() {
  if (useRedis) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialDb: DB = {
      dailyChallenges: {},
      results: {},
      bestHumanScores: {},
      cachedChallenges: {},
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2));
  }
}

function readDb(): DB {
  if (useRedis) throw new Error("Should not use readDb with Redis");
  ensureDb();
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(data) as Partial<DB>;
    return {
      dailyChallenges: parsed.dailyChallenges || {},
      results: parsed.results || {},
      bestHumanScores: parsed.bestHumanScores || {},
      cachedChallenges: parsed.cachedChallenges || {},
    };
  } catch (error) {
    console.error("Error reading DB:", error);
    return {
      dailyChallenges: {},
      results: {},
      bestHumanScores: {},
      cachedChallenges: {},
    };
  }
}

function writeDb(db: DB) {
  if (useRedis) throw new Error("Should not use writeDb with Redis");
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export const store = {
  getDailyChallengeId: async (date: string): Promise<string | undefined> => {
    if (useRedis && redis) {
      return (await redis.get<string>(`daily:${date}`)) || undefined;
    }
    const db = readDb();
    return db.dailyChallenges[date];
  },

  setDailyChallengeId: async (date: string, challengeId: string) => {
    if (useRedis && redis) {
      await redis.set(`daily:${date}`, challengeId);
      return;
    }
    const db = readDb();
    db.dailyChallenges[date] = challengeId;
    writeDb(db);
  },

  getResult: async (
    challengeId: string,
    modelId: string
  ): Promise<RunResult | undefined> => {
    if (useRedis && redis) {
      return (
        (await redis.hget<RunResult>(`results:${challengeId}`, modelId)) ||
        undefined
      );
    }
    const db = readDb();
    return db.results[challengeId]?.[modelId];
  },

  saveResult: async (challengeId: string, result: RunResult) => {
    if (useRedis && redis) {
      await redis.hset(`results:${challengeId}`, { [result.modelId]: result });
      return;
    }
    const db = readDb();
    if (!db.results[challengeId]) {
      db.results[challengeId] = {};
    }
    db.results[challengeId][result.modelId] = result;
    writeDb(db);
  },

  getBestHumanScore: async (
    challengeId: string
  ): Promise<number | undefined> => {
    if (useRedis && redis) {
      const value = await redis.get<number>(`best:${challengeId}`);
      return typeof value === "number" ? value : undefined;
    }
    const db = readDb();
    return db.bestHumanScores[challengeId];
  },

  saveBestHumanScore: async (challengeId: string, score: number) => {
    if (!Number.isFinite(score)) return;
    if (useRedis && redis) {
      await redis.set(`best:${challengeId}`, score);
      return;
    }
    const db = readDb();
    db.bestHumanScores[challengeId] = score;
    writeDb(db);
  },

  getChallenge: async (challengeId: string): Promise<Challenge | undefined> => {
    if (useRedis && redis) {
      return (
        (await redis.get<Challenge>(`challenge:${challengeId}`)) || undefined
      );
    }
    const db = readDb();
    return db.cachedChallenges[challengeId];
  },

  saveChallenge: async (challenge: Challenge) => {
    if (!challenge?.id) return;
    if (useRedis && redis) {
      await redis.set(`challenge:${challenge.id}`, challenge);
      return;
    }
    const db = readDb();
    db.cachedChallenges[challenge.id] = challenge;
    writeDb(db);
  },
};
