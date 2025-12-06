import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redisConfig =
  (process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN && {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) ||
  (process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN && {
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

const redis = redisConfig ? new Redis(redisConfig) : null;

export async function GET() {
  if (!redis) {
    return NextResponse.json(
      { ok: false, error: "Redis env vars missing" },
      { status: 503 }
    );
  }

  const key = "health:kv";
  const value = `ok:${Date.now()}`;

  try {
    await redis.set(key, value, { ex: 60 });
    const echoed = await redis.get<string>(key);

    if (echoed !== value) {
      return NextResponse.json(
        { ok: false, error: "KV echo mismatch" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, key, value });
  } catch (error) {
    console.error("KV health check failed", error);
    return NextResponse.json(
      { ok: false, error: "KV operation failed" },
      { status: 503 }
    );
  }
}
