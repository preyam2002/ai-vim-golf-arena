import { fetchChallenge } from "../src/lib/challenge-source.ts";
import { listOfflineChallenges } from "../src/lib/offline-library.ts";

async function main() {
  const challenges = listOfflineChallenges(10);
  console.log(`Scraping ${challenges.length} default curated challenges...`);

  for (const { id, title } of challenges) {
    try {
      console.log(`→ ${id} (${title})`);
      const result = await fetchChallenge(id);
      console.log(
        `  saved: "${result.title}" | bestHuman=${result.bestHumanScore} | len=${result.startText.length}/${result.targetText.length}`
      );
    } catch (error) {
      console.error(`  failed: ${id}`, error);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("Fatal error", error);
  process.exit(1);
});

