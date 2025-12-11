import fs from "fs";
import path from "path";

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

interface RunResult {
  modelId: string;
  // ... other fields
}

interface DB {
  dailyChallenges: Record<string, string>;
  results: Record<string, Record<string, RunResult>>;
  bestHumanScores: Record<string, number>;
  cachedChallenges: Record<string, any>;
}

type SolutionMap = Record<string, Record<string, RunResult>>;

function main() {
  console.log("Checking for challenges without solutions...");

  let db: DB | null = null;
  try {
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading db.json", e);
  }

  let solutions: SolutionMap = {};
  try {
    if (fs.existsSync(SOLUTIONS_PATH)) {
      solutions = JSON.parse(fs.readFileSync(SOLUTIONS_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading challenge-solutions.json", e);
  }

  let popularChallenges: any[] = [];
  try {
    if (fs.existsSync(POPULAR_CHALLENGES_PATH)) {
      popularChallenges = JSON.parse(
        fs.readFileSync(POPULAR_CHALLENGES_PATH, "utf-8")
      );
    }
  } catch (e) {
    console.error("Error reading popular-challenges.json", e);
  }

  // Check cachedChallenges in db.json
  if (db && db.cachedChallenges) {
    const challengeIds = Object.keys(db.cachedChallenges);
    const missingSolutions: string[] = [];

    for (const id of challengeIds) {
      const hasDbSolution =
        db.results?.[id] && Object.keys(db.results[id]).length > 0;
      const hasOfflineSolution =
        solutions[id] && Object.keys(solutions[id]).length > 0;

      if (!hasDbSolution && !hasOfflineSolution) {
        missingSolutions.push(id);
      }
    }

    console.log(
      `\nFound ${missingSolutions.length} challenges in db.json (cachedChallenges) without solutions:`
    );
    if (missingSolutions.length > 0) {
      missingSolutions.forEach((id) =>
        console.log(
          `- ${id} (${db?.cachedChallenges[id]?.title || "No Title"})`
        )
      );
    }
  } else {
    console.log("\ndb.json or cachedChallenges not found/empty.");
  }

  // Check popular-challenges.json
  if (popularChallenges.length > 0) {
    const missingSolutionsPopular: string[] = [];
    for (const challenge of popularChallenges) {
      const id = challenge.id;
      const hasDbSolution =
        db?.results?.[id] && Object.keys(db.results[id]).length > 0;
      const hasOfflineSolution =
        solutions[id] && Object.keys(solutions[id]).length > 0;

      if (!hasDbSolution && !hasOfflineSolution) {
        missingSolutionsPopular.push(id);
      }
    }
    console.log(
      `\nFound ${missingSolutionsPopular.length} challenges in popular-challenges.json without solutions:`
    );
    if (missingSolutionsPopular.length > 0) {
      missingSolutionsPopular.forEach((id) => console.log(`- ${id}`));
    }
  } else {
    console.log("\npopular-challenges.json not found/empty.");
  }
}

main();
