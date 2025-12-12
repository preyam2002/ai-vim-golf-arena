const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const CHALLENGES_PATH = path.join(__dirname, '../data/popular-challenges.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const challenges = JSON.parse(fs.readFileSync(CHALLENGES_PATH, 'utf8'));
const challengeMap = new Map(challenges.map(c => [c.id, c]));

function normalize(text) {
  if (!text) return "";
  return text.trim().replace(/\r\n/g, '\n');
}

let changed = 0;

for (const challengeId of Object.keys(db.results)) {
  const challenge = challengeMap.get(challengeId);
  if (!challenge) continue;

  const target = normalize(challenge.targetText);
  const modelResults = db.results[challengeId];

  for (const modelId of Object.keys(modelResults)) {
    const res = modelResults[modelId];
    if (res.success !== false) {
      // It is marked as success (or undefined, which means success)
      const final = normalize(res.finalText);
      if (final !== target) {
        console.log(`[Patch] Marking ${challengeId} / ${modelId} as failed.`);
        console.log(`  Expected len: ${target.length}`);
        console.log(`  Actual len:   ${final.length}`);
        res.success = false;
        changed++;
        
        if (final.length === 0 && target.length > 0) {
            console.log("  Reason: Empty final text");
        }
      }
    }
  }
}

if (changed > 0) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Updated ${changed} entries in db.json`);
} else {
  console.log("No changes needed.");
}
