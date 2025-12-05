import fs from "fs";
import path from "path";
import { kv } from "@vercel/kv";
import type { RunResult } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

interface DB {
  dailyChallenges: Record<string, string>; // date (YYYY-MM-DD) -> challengeId
  results: Record<string, Record<string, RunResult>>; // challengeId -> modelId -> RunResult
}

// Helper to check if we should use Vercel KV
const useKv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

function ensureDb() {
  if (useKv) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialDb: DB = { dailyChallenges: {}, results: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2));
  }
}

function readDb(): DB {
  if (useKv) throw new Error("Should not use readDb with KV");
  ensureDb();
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading DB:", error);
    return { dailyChallenges: {}, results: {} };
  }
}

function writeDb(db: DB) {
  if (useKv) throw new Error("Should not use writeDb with KV");
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export const store = {
  getDailyChallengeId: async (date: string): Promise<string | undefined> => {
    if (useKv) {
      return (await kv.get<string>(`daily:${date}`)) || undefined;
    }
    const db = readDb();
    return db.dailyChallenges[date];
  },

  setDailyChallengeId: async (date: string, challengeId: string) => {
    if (useKv) {
      await kv.set(`daily:${date}`, challengeId);
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
    if (useKv) {
      return (
        (await kv.hget<RunResult>(`results:${challengeId}`, modelId)) ||
        undefined
      );
    }
    const db = readDb();
    return db.results[challengeId]?.[modelId];
  },

  saveResult: async (challengeId: string, result: RunResult) => {
    if (useKv) {
      await kv.hset(`results:${challengeId}`, { [result.modelId]: result });
      return;
    }
    const db = readDb();
    if (!db.results[challengeId]) {
      db.results[challengeId] = {};
    }
    db.results[challengeId][result.modelId] = result;
    writeDb(db);
  },
};
