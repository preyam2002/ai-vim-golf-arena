import type { Challenge, RunResult } from "./types";
import challengesJson from "../../data/popular-challenges.json";
import solutionsJson from "../../data/challenge-solutions.json";

type SolutionMap = Record<string, Record<string, RunResult>>;

const offlineChallenges: Challenge[] = challengesJson as Challenge[];
const challengeMap = new Map<string, Challenge>(
  offlineChallenges.map((c) => [c.id, c])
);

const solutions: SolutionMap = (solutionsJson as SolutionMap) || {};

export function listOfflineChallenges(limit?: number): Challenge[] {
  return typeof limit === "number"
    ? offlineChallenges.slice(0, Math.max(0, limit))
    : offlineChallenges;
}

export function getOfflineChallenge(id: string): Challenge | undefined {
  return challengeMap.get(id);
}

export function getOfflineSolution(
  challengeId: string,
  modelId: string
): RunResult | undefined {
  return solutions[challengeId]?.[modelId];
}

export function getOfflineSolutions(
  challengeId: string
): Record<string, RunResult> | undefined {
  return solutions[challengeId];
}

export function hasOfflineSolution(challengeId: string): boolean {
  return !!solutions[challengeId] || challengeMap.has(challengeId);
}

