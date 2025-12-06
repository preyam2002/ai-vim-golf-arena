import { type NextRequest, NextResponse } from "next/server";
import { fetchChallenge, getAllStaticChallenges } from "@/lib/challenge-source";

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const listAll = searchParams.get("list");
  const limitParam = searchParams.get("limit");
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize") ?? limitParam;

  if (listAll === "true") {
    const challenges = shuffleArray(getAllStaticChallenges());
    const pageFromQuery = pageParam ? Number.parseInt(pageParam, 10) : 1;
    const requestedPage =
      Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1;
    const pageSizeFromQuery = pageSizeParam
      ? Number.parseInt(pageSizeParam, 10)
      : 9;
    const pageSize =
      Number.isFinite(pageSizeFromQuery) && pageSizeFromQuery > 0
        ? pageSizeFromQuery
        : 20;

    const total = challenges.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const paginated = challenges.slice(start, start + pageSize);

    return NextResponse.json({
      challenges: paginated,
      total,
      page: currentPage,
      pageSize,
      totalPages,
    });
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
