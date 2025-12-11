import fs from "fs";
import path from "path";
import { staticChallenges } from "../src/lib/static-challenges"; // This might fail due to TS config, so I'll just hardcode or read file if needed.
// Actually, I can't easily import TS files from src/lib in this script execution context if they have dependencies.
// Faster to just read JSONs.

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const SOLUTIONS_PATH = path.join(
  process.cwd(),
  "data",
  "challenge-solutions.json"
);
const POPULAR_CHALLENGES_PATH = path.join(
  process.cwd(),
  "data",
  "popular-challenges.json"
);

function main() {
  let dbResults: Record<string, any> = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      dbResults = db.results || {};
    } catch (e) {}
  }

  let solutions: Record<string, any> = {};
  if (fs.existsSync(SOLUTIONS_PATH)) {
    try {
      solutions = JSON.parse(fs.readFileSync(SOLUTIONS_PATH, "utf-8"));
    } catch (e) {}
  }

  let popularChallenges: any[] = [];
  if (fs.existsSync(POPULAR_CHALLENGES_PATH)) {
    try {
      popularChallenges = JSON.parse(
        fs.readFileSync(POPULAR_CHALLENGES_PATH, "utf-8")
      );
    } catch (e) {}
  }

  // Top 10 Popular Challenges
  const top10 = popularChallenges.slice(0, 10);
  console.log("Checking Top 10 Popular Challenges for solutions:");

  const missingInUI: string[] = [];

  for (const challenge of top10) {
    const id = challenge.id;
    const hasDbResult = dbResults[id] && Object.keys(dbResults[id]).length > 0;
    const hasOfflineSolution =
      solutions[id] && Object.keys(solutions[id]).length > 0;

    if (!hasDbResult && !hasOfflineSolution) {
      console.log(`[MISSING] ${id}: ${challenge.title}`);
      missingInUI.push(id);
    } else {
      // console.log(`[OK] ${id}`);
    }
  }

  if (missingInUI.length === 0) {
    console.log("All top 10 popular challenges have solutions.");
  }

  // Also query static challenges implicitly by ID if we knew them.
  // Static IDs: static-1 to static-10.
  // Checking static challenges
  console.log("\nChecking Static Challenges for solutions:");
  const staticIds = [
    "static-1",
    "static-2",
    "static-3",
    "static-4",
    "static-5",
    "static-6",
    "static-7",
    "static-8",
    "static-9",
    "static-10",
  ];
  for (const id of staticIds) {
    const hasDbResult = dbResults[id] && Object.keys(dbResults[id]).length > 0;
    // Static challenges likely don't have entries in challenge-solutions.json, but let's check.
    const hasOfflineSolution =
      solutions[id] && Object.keys(solutions[id]).length > 0;

    if (!hasDbResult && !hasOfflineSolution) {
      console.log(`[MISSING] ${id}`);
    }
  }
}

main();
