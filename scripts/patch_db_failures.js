
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// List of result keys to mark as failed
const updates = [
  { challengeId: 'static-1', modelId: 'xai/grok-4-fast-reasoning' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'xai/grok-code-fast-1' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'anthropic/claude-3.7-sonnet' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'anthropic/claude-haiku-4.5' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'anthropic/claude-sonnet-4' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'google/gemini-2.5-flash' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'google/gemini-2.5-flash-lite' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'openai/gpt-5-codex' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'openai/gpt-5' },
  { challengeId: '9v00680e54330000000006c0', modelId: 'openai/gpt-5-mini' }
];

let changedCount = 0;

updates.forEach(({ challengeId, modelId }) => {
  if (db.results[challengeId] && db.results[challengeId][modelId]) {
    if (db.results[challengeId][modelId].success === true) {
      db.results[challengeId][modelId].success = false;
      console.log(`Updated ${challengeId} - ${modelId} to success: false`);
      changedCount++;
    } else {
      console.log(`Skipping ${challengeId} - ${modelId}, already false or missing`);
    }
  } else {
    console.warn(`Warning: Could not find result for ${challengeId} - ${modelId}`);
  }
});

if (changedCount > 0) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Successfully updated ${changedCount} entries in db.json`);
} else {
  console.log('No changes made to db.json');
}
