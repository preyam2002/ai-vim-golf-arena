import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// function to load env
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, "");
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.warn("Could not read .env file");
  }
}

loadEnv();

async function main() {
  console.log("Verifying Redis data...");

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error("❌ Missing Redis credentials.");
    process.exit(1);
  }

  const redis = new Redis({ url, token });

  // Verify a known key
  try {
    const score = await redis.get("best:static-1");
    console.log(`[VERIFY] best:static-1 = ${score}`);

    if (score === 14) {
      console.log("✅ Verified correct score for static-1");
    } else {
      console.log("⚠️ Score mismatch or missing (expected 14)");
    }

    // Verify a challenge exists
    // Pick first one from db if possible, or just check 'challenge:static-1' if it was cached.
    // Let's check a random key we saw in the logs or assume one.
    // The previous script migrated 59 cached challenges.
  } catch (e) {
    console.error("❌ Error connecting to Redis:", e);
  }
}

main();
