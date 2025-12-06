/* eslint-env node */
/* global fetch, console, setTimeout, process */

import fs from 'fs';
import path from 'path';

async function scrapePopularChallenges() {
  console.log("Fetching vimgolf.com...");
  try {
    const response = await fetch("https://www.vimgolf.com/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Regex to find challenges
    // Pattern: <h5><a href="/challenges/ID">TITLE</a> - ENTRIES entries</h5>
    // Note: The HTML structure might vary, so we'll try to be robust.
    // Based on previous view_content_chunk, it looks like:
    // ##### [Title](https://www.vimgolf.com/challenges/ID) - N entries
    // Wait, the previous view_content_chunk showed markdown because read_url_content converts to markdown.
    // The raw HTML is likely <h5><a href="/challenges/...">...</a></h5> or similar.
    
    // Let's use a regex that captures the ID and Title from the href and text.
    // We'll look for the link pattern specifically.
    
    const challengeRegex = /href="\/challenges\/([a-z0-9]+)">([^<]+)<\/a>/g;
    const matches = [...html.matchAll(challengeRegex)];
    
    console.log(`Found ${matches.length} challenge links.`);

    const uniqueChallenges = new Map();

    for (const match of matches) {
      const id = match[1];
      const title = match[2];
      
      if (!uniqueChallenges.has(id)) {
        uniqueChallenges.set(id, {
          id,
          title: title.trim(),
          // We don't have description or score easily from just the link, 
          // but we can fetch details later if needed. For now, let's just get the list.
        });
      }
    }

    const challenges = Array.from(uniqueChallenges.values());
    console.log(`Unique challenges: ${challenges.length}`);
    
    // We want 100. If we have fewer, that's fine.
    const top100 = challenges.slice(0, 100);
    
    // Now let's try to fetch details for them to make them useful immediately
    // We'll do this in batches to be nice to the server
    
    const detailedChallenges = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < top100.length; i += BATCH_SIZE) {
        const batch = top100.slice(i, i + BATCH_SIZE);
        console.log(`Fetching details for batch ${i + 1}-${Math.min(i + BATCH_SIZE, top100.length)}...`);
        
        await Promise.all(batch.map(async (challenge) => {
            try {
                const res = await fetch(`https://www.vimgolf.com/challenges/${challenge.id}.json`);
                if (res.ok) {
                    const data = await res.json();
                    let bestHumanScore = normalizeScore(data.best ?? data.record);

                    // Fallback to HTML scrape when JSON omits the human score (returns 999)
                    if (!Number.isFinite(bestHumanScore) || bestHumanScore >= 999) {
                        try {
                            const htmlRes = await fetch(`https://www.vimgolf.com/challenges/${challenge.id}`);
                            if (htmlRes.ok) {
                                const html = await htmlRes.text();
                                const scraped = extractBestScoreFromHtml(html);
                                if (Number.isFinite(scraped)) {
                                    bestHumanScore = scraped;
                                }
                            }
                        } catch (htmlError) {
                            console.warn(`HTML scrape failed for ${challenge.id}:`, htmlError);
                        }
                    }

                    detailedChallenges.push({
                        id: challenge.id,
                        title: data.title || challenge.title,
                        description: data.description || "VimGolf Challenge",
                        startText: data.in?.data || data.input || "",
                        targetText: data.out?.data || data.output || "",
                        bestHumanScore: Number.isFinite(bestHumanScore) ? bestHumanScore : 999
                    });
                } else {
                    console.warn(`Failed to fetch details for ${challenge.id}`);
                }
            } catch (e) {
                console.warn(`Error fetching ${challenge.id}:`, e);
            }
        }));
        
        // Small delay between batches
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Successfully fetched details for ${detailedChallenges.length} challenges.`);

    const outputPath = path.join(process.cwd(), 'src', 'data', 'popular-challenges.json');
    
    // Ensure directory exists
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(detailedChallenges, null, 2));
    console.log(`Saved to ${outputPath}`);

  } catch (e) {
    console.error("Scraping failed:", e);
    process.exit(1);
  }
}

function normalizeScore(value) {
    const num = typeof value === "string" ? Number.parseInt(value, 10) : value;
    return Number.isFinite(num) ? num : 999;
}

function extractBestScoreFromHtml(html) {
    const leaderboardSlice =
        html.match(/Leaderboard[\s\S]*?(?=Changelog|<\/body>|$)/i)?.[0] || html;

    const text = leaderboardSlice
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const scores = new Set();

    for (const match of text.matchAll(/Score:\s*([0-9]{1,4})/gi)) {
        const value = Number.parseInt(match[1], 10);
        if (value > 0 && value < 2000) scores.add(value);
    }

    for (const match of text.matchAll(/#\d+[^0-9]{0,80}?([0-9]{1,4})/gi)) {
        const value = Number.parseInt(match[1], 10);
        if (value > 0 && value < 2000) scores.add(value);
    }

    if (scores.size === 0) return 999;
    return Math.min(...scores);
}

scrapePopularChallenges();
