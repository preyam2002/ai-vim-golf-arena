import fs from "fs";
import path from "path";

const POPULAR_CHALLENGES_PATH = path.join(
  process.cwd(),
  "data",
  "popular-challenges.json"
);

function main() {
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

  console.log("Top 10 Popular Challenges (Visible in UI):");
  const top10 = popularChallenges.slice(0, 10);
  top10.forEach((c, i) => console.log(`${i + 1}. ${c.id}`));
}

main();
