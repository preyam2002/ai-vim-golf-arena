import type { Challenge } from "./types";
import {
  staticChallenges,
  getRandomChallenge,
  getChallengeById,
} from "./static-challenges";
import {
  getOfflineChallenge,
  listOfflineChallenges,
} from "./offline-library";

export async function fetchChallenge(id: string): Promise<Challenge> {
  if (id === "random") {
    try {
      const randomId = await fetchRandomChallengeIdFromSource();
      if (randomId) {
        return fetchChallenge(randomId);
      }
    } catch (e) {
      console.warn(
        "Failed to fetch random challenge from source, using fallback",
        e
      );
    }
    return getRandomChallenge();
  }

  const staticChallenge = getChallengeById(id);
  if (staticChallenge) {
    return staticChallenge;
  }

  const offlineChallenge = getOfflineChallenge(id);
  if (offlineChallenge) {
    return offlineChallenge;
  }

  let challenge: Challenge | null = null;

  try {
    const response = await fetch(
      `https://www.vimgolf.com/challenges/${id}.json`,
      {
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch challenge");
    }

    const data = await response.json();

    challenge = {
      id: id,
      title: data.title || "VimGolf Challenge",
      description: data.description || "Complete the transformation",
      startText: data.in?.data || data.input || "",
      targetText: data.out?.data || data.output || "",
      bestHumanScore: normalizeScore(data.best ?? data.record),
    };
  } catch (error) {
    console.warn(
      `Failed to fetch VimGolf challenge ${id} via JSON, trying HTML fallback`,
      error
    );
  }

  // Fallback: scrape HTML page when JSON is missing the best score or failed
  if (
    !challenge ||
    !Number.isFinite(challenge.bestHumanScore) ||
    challenge.bestHumanScore >= 999
  ) {
    const parsed = await parseVimGolfPage(id);
    if (parsed) {
      challenge = {
        id,
        title: challenge?.title ?? parsed.title,
        description: challenge?.description ?? parsed.description,
        startText: challenge?.startText || parsed.startText,
        targetText: challenge?.targetText || parsed.targetText,
        bestHumanScore: parsed.bestHumanScore,
      };
    }
  }

  if (challenge) {
    return challenge;
  }

  console.warn(`Falling back to random challenge after failing to load ${id}`);
  return getRandomChallenge();
}

async function fetchRandomChallengeIdFromSource(): Promise<string | null> {
  const offline = listOfflineChallenges();
  if (offline.length > 0) {
    const randomIndex = Math.floor(Math.random() * offline.length);
    return offline[randomIndex].id;
  }

  // 2. Fallback to scraping if local file is empty (unlikely but good safety)
  try {
    const response = await fetch("https://www.vimgolf.com/", {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    // Match all challenge links: <a href="/challenges/5d1c...">
    const matches = [...html.matchAll(/href="\/challenges\/([a-z0-9]+)"/g)];

    if (matches.length === 0) return null;

    // Pick a random match
    const randomIndex = Math.floor(Math.random() * matches.length);
    return matches[randomIndex][1];
  } catch (e) {
    console.error("Error scraping vimgolf.com:", e);
    return null;
  }
}

export async function parseVimGolfPage(id: string): Promise<Challenge | null> {
  try {
    const response = await fetch(`https://www.vimgolf.com/challenges/${id}`, {
      headers: {
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    const titleMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
    const descMatch = html.match(/<div class="description"[^>]*>([^<]+)/);
    const scoreMatch = extractBestScore(html);

    const startMatch = html.match(
      /Start file:[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/i
    );
    const endMatch = html.match(
      /End file:[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/i
    );

    if (!startMatch || !endMatch) return null;

    const leaderboardScore = extractBestScoreFromLeaderboard(html);
    const bestHumanScore = pickBestScore(scoreMatch, leaderboardScore);

    return {
      id,
      title: titleMatch?.[1]?.trim() || "VimGolf Challenge",
      description: descMatch?.[1]?.trim() || "Complete the transformation",
      startText: decodeHtmlEntities(startMatch[1]),
      targetText: decodeHtmlEntities(endMatch[1]),
      bestHumanScore,
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractBestScore(html: string): number | null {
  const patterns = [
    /Best score[^0-9]*([0-9]+)/i,
    /record[^0-9]*([0-9]+)/i,
    /Best[^0-9]*([0-9]+)/i,
    /class="best[^"]*">(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) return value;
    }
  }

  return null;
}

function extractBestScoreFromLeaderboard(html: string): number | null {
  // Narrow to the leaderboard section to reduce noise from years/timestamps.
  const leaderboardSlice =
    html.match(/Leaderboard[\s\S]*?(?=Changelog|<\/body>|$)/i)?.[0] || html;

  // Strip tags and collapse whitespace.
  const text = leaderboardSlice
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const scores = new Set<number>();

  // Pattern 1: "Score: 485"
  for (const match of text.matchAll(/Score:\s*([0-9]{1,4})/gi)) {
    const value = Number.parseInt(match[1], 10);
    if (value > 0 && value < 2000) scores.add(value);
  }

  // Pattern 2: leaderboard lines like "#1 ... 17"
  for (const match of text.matchAll(/#\d+[^0-9]{0,80}?([0-9]{1,4})/gi)) {
    const value = Number.parseInt(match[1], 10);
    if (value > 0 && value < 2000) scores.add(value);
  }

  if (scores.size === 0) return null;
  return Math.min(...scores);
}

function normalizeScore(value: unknown): number {
  const num =
    typeof value === "string" ? Number.parseInt(value, 10) : (value as number);
  return Number.isFinite(num) ? num : 999;
}

function pickBestScore(...candidates: Array<number | null | undefined>): number {
  const valid = candidates
    .filter((v) => Number.isFinite(v))
    .map((v) => Number(v))
    .filter((v) => v > 0);
  if (valid.length === 0) return 999;
  return Math.min(...valid);
}

export function getAllStaticChallenges(): Challenge[] {
  return [...staticChallenges, ...listOfflineChallenges()];
}

export function getDailyChallenge(date: string): Challenge {
  // Simple seeded random using DJB2 hash of the date string
  let hash = 5381;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 33) ^ date.charCodeAt(i);
  }
  // Force positive
  hash = hash >>> 0;

  const index = hash % staticChallenges.length;
  console.log(
    `[Challenge Source] getDailyChallenge for ${date}: hash=${hash}, index=${index}, id=${staticChallenges[index].id}`
  );
  return staticChallenges[index];
}
