/* eslint-disable */
import type { Challenge } from "./types";
// eslint-disable-next-line import/extensions
import {
  staticChallenges,
  getRandomChallenge,
  getChallengeById,
} from "./static-challenges.ts";
// eslint-disable-next-line import/extensions
import {
  getOfflineChallenge,
  listOfflineChallenges,
} from "./offline-library.ts";
// ... existing code ...

const BEST_HUMAN_UNKNOWN = 999;
const MIN_BEST_HUMAN_SCORE = 2;
const PLACEHOLDER_DESCRIPTIONS = new Set([
  "VimGolf Challenge",
  "Complete the transformation",
]);

function isValidBestHumanScore(score?: number): score is number {
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= MIN_BEST_HUMAN_SCORE &&
    score < BEST_HUMAN_UNKNOWN
  );
}

function needsDescription(challenge: Challenge | null): boolean {
  const desc = challenge?.description?.trim() ?? "";
  return desc.length === 0 || PLACEHOLDER_DESCRIPTIONS.has(desc);
}

async function getCachedChallenge(id: string): Promise<Challenge | undefined> {
  try {
    // eslint-disable-next-line import/extensions
    const { store } = await import("./store.ts");
    return store.getChallenge ? store.getChallenge(id) : undefined;
  } catch (error) {
    console.warn(
      `[Challenge Source] Failed to read cached challenge ${id}`,
      error
    );
    return undefined;
  }
}

async function persistChallenge(challenge: Challenge): Promise<void> {
  try {
    // eslint-disable-next-line import/extensions
    const { store } = await import("./store.ts");
    if (store.saveChallenge) {
      await store.saveChallenge(challenge);
    }
  } catch (error) {
    console.warn(
      `[Challenge Source] Failed to persist challenge ${challenge.id}`,
      error
    );
  }
}

async function getCachedBestHumanScore(
  challengeId: string
): Promise<number | undefined> {
  try {
    // eslint-disable-next-line import/extensions
    const { store } = await import("./store.ts");
    return store.getBestHumanScore
      ? store.getBestHumanScore(challengeId)
      : undefined;
  } catch (error) {
    console.warn(
      `[Challenge Source] Failed to read cached best human for ${challengeId}`,
      error
    );
    return undefined;
  }
}

async function persistBestHumanScore(
  challengeId: string,
  score?: number
): Promise<void> {
  if (!isValidBestHumanScore(score)) return;
  try {
    // eslint-disable-next-line import/extensions
    const { store } = await import("./store.ts");
    if (store.saveBestHumanScore) {
      await store.saveBestHumanScore(challengeId, score);
    }
  } catch (error) {
    console.warn(
      `[Challenge Source] Failed to persist best human for ${challengeId}`,
      error
    );
  }
}

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

  const staticCandidate = getChallengeById(id);
  const offlineCandidate = staticCandidate ? null : getOfflineChallenge(id);
  const isOfflineChallenge = !!offlineCandidate;

  let challenge: Challenge | null = staticCandidate ?? offlineCandidate ?? null;

  if (!challenge) {
    const cached = await getCachedChallenge(id);
    if (cached) {
      challenge = cached;
    }
  }

  const needsBestHuman = (c: Challenge | null) =>
    !c || !isValidBestHumanScore(c.bestHumanScore);

  // Do not auto-refresh offline bundled challenges from remote; they are curated.
  const shouldRefreshFromSource = false;

  // Hard stop: never re-scrape default (bundled) challenges from remote.
  if (staticCandidate || offlineCandidate) {
    // Prefer cached best human score if the bundled one is invalid.
    if (challenge && !isValidBestHumanScore(challenge.bestHumanScore)) {
      const cachedBest = await getCachedBestHumanScore(id);
      if (isValidBestHumanScore(cachedBest)) {
        challenge.bestHumanScore = cachedBest;
      }
    }

    if (challenge) {
      await Promise.allSettled([
        persistBestHumanScore(id, challenge.bestHumanScore),
        persistChallenge(challenge),
      ]);
      return challenge;
    }
  }

  if (
    needsBestHuman(challenge) ||
    needsDescription(challenge) ||
    shouldRefreshFromSource
  ) {
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
        id,
        title: data.title || challenge?.title || "VimGolf Challenge",
        description: challenge?.description || "Complete the transformation",
        startText: data.in?.data || data.input || challenge?.startText || "",
        targetText:
          data.out?.data || data.output || challenge?.targetText || "",
        bestHumanScore: normalizeScore(data.best ?? data.record),
      };
    } catch (error) {
      console.warn(
        `Failed to fetch VimGolf challenge ${id} via JSON, trying HTML fallback`,
        error
      );
    }
  }

  // Try cached best human when we don't have a valid value.
  if (challenge && !isValidBestHumanScore(challenge.bestHumanScore)) {
    const cachedBest = await getCachedBestHumanScore(id);
    if (isValidBestHumanScore(cachedBest)) {
      challenge.bestHumanScore = cachedBest;
    }
  }

  // Keep the curated offline text when available to avoid corrupted upstream data
  // overriding our known-good start/target content (e.g. when the remote payload
  // contains a diff or keystroke log instead of the actual files).
  if (challenge && offlineCandidate) {
    if (offlineCandidate.startText?.trim()) {
      challenge.startText = offlineCandidate.startText;
    }
    if (offlineCandidate.targetText?.trim()) {
      challenge.targetText = offlineCandidate.targetText;
    }
  }

  // Last-resort guard: if targetText looks like a keystroke/script log, fall back to offline/static text.
  if (challenge) {
    const looksCorrupted =
      challenge.targetText?.includes("entry-script") ||
      challenge.targetText?.includes('<span class="entry-script"');
    if (looksCorrupted) {
      const clean = offlineCandidate || staticCandidate;
      if (clean?.targetText?.trim()) {
        challenge.targetText = clean.targetText;
      }
      if (clean?.startText?.trim()) {
        challenge.startText = clean.startText;
      }
    }
  }

  // Fallback: scrape HTML page when JSON/offline/static is missing the best score or description or failed
  if (
    needsBestHuman(challenge) ||
    needsDescription(challenge) ||
    shouldRefreshFromSource
  ) {
    const parsed = await parseVimGolfPage(id);
    if (parsed) {
      challenge = {
        id,
        title: challenge?.title ?? parsed.title,
        description: parsed.description,
        startText: parsed.startText,
        targetText: parsed.targetText,
        bestHumanScore: parsed.bestHumanScore,
      };
    }
  }

  if (challenge) {
    await Promise.allSettled([
      persistBestHumanScore(id, challenge.bestHumanScore),
      persistChallenge(challenge),
    ]);
    return challenge;
  }

  console.warn(`Falling back to random challenge after failing to load ${id}`);
  return getRandomChallenge();
}

async function fetchRandomChallengeIdFromSource(): Promise<string | null> {
  const offline = listOfflineChallenges(10);
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

    let startMatch = html.match(
      /Start file:[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/i
    );
    let endMatch = html.match(/End file:[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/i);

    // Fallback: some pages (e.g. 50ef5caf767623000200004b) omit the "Start file" label.
    if (!startMatch || !endMatch) {
      const preMatches = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)];
      if (preMatches.length >= 2) {
        startMatch = preMatches[preMatches.length - 2];
        endMatch = preMatches[preMatches.length - 1];
      }
    }

    if (!startMatch || !endMatch) return null;

    const leaderboardScore = extractBestScoreFromLeaderboard(html);
    const bestHumanScore = pickBestScore(scoreMatch, leaderboardScore);

    const parsedTitle = titleMatch?.[1]?.trim() || "VimGolf Challenge";
    const description = extractDescription(html) || `${parsedTitle} challenge`;

    return {
      id,
      title: parsedTitle,
      description,
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

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractDescription(html: string): string | undefined {
  const tryDecode = (value?: string | null) =>
    value
      ? cleanText(decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")))
      : undefined;
  const isDateish = (value: string) =>
    /\b\d{2}\/\d{2}\/\d{4}\b/i.test(value) ||
    /\b\d{1,2}:\d{2}(AM|PM)\b/i.test(value);

  const descBlock =
    html.match(/<div class="description"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null;
  const metaOg = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  )?.[1];
  const metaName = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  )?.[1];

  // Paragraph immediately after H2 and before the first <pre>/Start file section
  const h2Index = html.search(/<h2[^>]*>/i);
  let paraAfterH2: string | undefined;
  if (h2Index >= 0) {
    const slice = html.slice(h2Index);
    const preBoundary = slice.search(/<pre|Start file:/i);
    const head = preBoundary > 0 ? slice.slice(0, preBoundary) : slice;
    const para = head.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    paraAfterH2 = para ? para.replace(/<[^>]+>/g, " ") : undefined;
  }

  const piChars = html.match(/(\d{2,6}\s*π\s*chars)/i)?.[1];

  const rawCandidates = [descBlock, paraAfterH2, metaOg, metaName, piChars];
  const candidates = rawCandidates.map(tryDecode).filter(Boolean) as string[];

  const pick = candidates.find(
    (t) => t.length > 0 && !PLACEHOLDER_DESCRIPTIONS.has(t) && !isDateish(t)
  );
  return pick;
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
    if (value >= MIN_BEST_HUMAN_SCORE && value < 2000) scores.add(value);
  }

  // Pattern 2: leaderboard line formatted as "<score> #<rank>"
  for (const match of text.matchAll(/(?:^|\s)([0-9]{1,4})\s+#\d+\b/g)) {
    const value = Number.parseInt(match[1], 10);
    if (value >= MIN_BEST_HUMAN_SCORE && value < 2000) scores.add(value);
  }

  if (scores.size === 0) return null;
  return Math.min(...scores);
}

function normalizeScore(value: unknown): number {
  const num =
    typeof value === "string" ? Number.parseInt(value, 10) : (value as number);
  return Number.isFinite(num) ? num : BEST_HUMAN_UNKNOWN;
}

function pickBestScore(
  ...candidates: Array<number | null | undefined>
): number {
  const valid = candidates
    .filter((v) => Number.isFinite(v))
    .map((v) => Number(v))
    .filter((v) => v >= MIN_BEST_HUMAN_SCORE);
  if (valid.length === 0) return BEST_HUMAN_UNKNOWN;
  return Math.min(...valid);
}

export function getAllStaticChallenges(): Challenge[] {
  return [...staticChallenges, ...listOfflineChallenges(10)];
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

// Determine if a challenge id belongs to our default set (static + offline JSON)
export function isDefaultChallengeId(id: string): boolean {
  return Boolean(getChallengeById(id) || getOfflineChallenge(id));
}

// List all default challenges for seeding (full offline list, no limit)
export function listAllDefaultChallenges(): Challenge[] {
  return [...staticChallenges, ...listOfflineChallenges()];
}
