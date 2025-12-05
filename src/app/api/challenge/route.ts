import { type NextRequest, NextResponse } from "next/server";
import { fetchChallenge, getAllStaticChallenges } from "@/lib/challenge-source";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const listAll = searchParams.get("list");
  const limitParam = searchParams.get("limit");

  if (listAll === "true") {
    const challenges = getAllStaticChallenges();
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    const limited =
      Number.isFinite(limit) && limit > 0
        ? challenges.slice(0, limit)
        : challenges;
    return NextResponse.json({ challenges: limited });
  }

  if (!id) {
    return NextResponse.json(
      { error: "Challenge ID required" },
      { status: 400 }
    );
  }

  try {
    let challengeId = id;

    // Handle daily challenge
    if (id === "daily") {
      const { getDailyChallenge } = await import("@/lib/challenge-source");
      const today = new Date().toISOString().split("T")[0];
      const dailyChallenge = getDailyChallenge(today);
      challengeId = dailyChallenge.id;
      console.log(
        `[Challenge API] Resolved daily challenge for ${today} to ${challengeId}`
      );
    }

    console.log(`[Challenge API] Fetching challenge: ${challengeId}`);

    const challenge = await fetchChallenge(challengeId);
    return NextResponse.json({ challenge });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge" },
      { status: 500 }
    );
  }
}
