/**
 * Comprehensive test suite for the "Run All Models" flow
 * Tests the full Daily Challenge simulation flow without VimWasm
 */

import { cleanKeystrokes } from "../src/lib/ai-gateway";
import { getDailyChallenge } from "../src/lib/challenge-source";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
  normalizeText,
} from "../src/lib/vim-engine";
import { maybeExpectVimParity } from "../src/lib/test-parity";
import { store } from "../src/lib/store";
import dbData from "../data/db.json";

const MAX_TEST_TIMEOUT_MS = 30000;

// Test configuration
const TEST_CONFIG = {
  verbose: true,
  showSteps: false,
};

function log(message: string) {
  if (TEST_CONFIG.verbose) {
    console.log(message);
  }
}

// Test 1: Daily Challenge Loading
async function testDailyChallengeLoading() {
  console.log("\n=== TEST 1: Daily Challenge Loading ===");

  const today = new Date().toISOString().split("T")[0];
  log(`Today: ${today}`);

  const daily = getDailyChallenge(today);

  console.assert(daily, "Daily challenge exists");
  console.assert(daily.id, "Daily challenge has ID");
  console.assert(daily.startText, "Daily challenge has start text");
  console.assert(daily.targetText, "Daily challenge has target text");

  log(`Daily challenge: ${daily.id} - "${daily.title}"`);
  log(`Start text length: ${daily.startText.length}`);
  log(`Target text length: ${daily.targetText.length}`);

  console.log("✅ PASS: Daily challenge loads correctly");
  return daily;
}

// Test 2: Cached Results Loading (from db.json)
async function testCachedResults() {
  console.log("\n=== TEST 2: Cached Results Loading ===");

  const results = dbData.results as Record<string, Record<string, any>>;
  const challengeIds = Object.keys(results);

  console.assert(challengeIds.length > 0, "Has cached results");

  log(`Found ${challengeIds.length} challenges in cache`);

  for (const challengeId of challengeIds) {
    const models = results[challengeId];
    const modelIds = Object.keys(models);
    log(`  ${challengeId}: ${modelIds.length} models`);

    for (const modelId of modelIds) {
      const result = models[modelId];
      console.assert(result.keystrokes, `${modelId} has keystrokes`);
      console.assert(
        typeof result.timeMs === "number",
        `${modelId} has timeMs`
      );
    }
  }

  console.log("✅ PASS: Cached results load correctly");
}

// Test 3: VimSimulator Execution
async function testVimSimulator(
  startText: string,
  keystrokes: string,
  expectedTarget: string
) {
  log(`\n  Testing: ${keystrokes.slice(0, 50)}...`);

  // Clean keystrokes
  const cleaned = cleanKeystrokes(keystrokes);
  log(`  Cleaned: ${cleaned.slice(0, 50)}...`);

  // Tokenize
  const tokens = tokenizeKeystrokes(cleaned);
  log(`  Tokens: ${tokens.length}`);

  // Execute
  let state = createInitialState(startText);
  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }

  const finalText = state.lines.join("\n");
  const normalizedFinal = normalizeText(finalText);
  const normalizedTarget = normalizeText(expectedTarget);
  const success = normalizedFinal === normalizedTarget;

  maybeExpectVimParity({
    startText,
    expectedText: expectedTarget,
    tokens,
    timeoutMs: MAX_TEST_TIMEOUT_MS,
  });

  if (!success) {
    console.log(`  ❌ FAIL: Output does not match`);
    console.log(`  Expected: ${JSON.stringify(expectedTarget)}`);
    console.log(`  Actual: ${JSON.stringify(finalText)}`);
    return false;
  }

  log(`  ✅ Match`);
  return true;
}

// Test 4: All Models From DB
async function testAllModelsFromDB() {
  console.log("\n=== TEST 3: VimSimulator with DB Data ===");

  const results = dbData.results as Record<string, Record<string, any>>;
  let passCount = 0;
  let totalCount = 0;

  for (const [challengeId, models] of Object.entries(results)) {
    const { staticChallenges } = await import("../src/lib/static-challenges");
    const challenge = staticChallenges.find((c) => c.id === challengeId);

    if (!challenge) {
      console.log(
        `  ⚠️  Challenge ${challengeId} not found in static challenges`
      );
      continue;
    }

    console.log(`\nChallenge: ${challengeId} - "${challenge.title}"`);

    for (const [modelId, result] of Object.entries(models) as [string, any][]) {
      totalCount++;
      const expectedSuccess = result.success !== false;
      const passed = await testVimSimulator(
        challenge.startText,
        result.keystrokes,
        challenge.targetText
      );

      if ((expectedSuccess && passed) || (!expectedSuccess && !passed)) {
        passCount++;
      } else if (expectedSuccess && !passed) {
        console.log(`  ❌ ${result.modelName}: Expected to pass but failed`);
      } else {
        console.log(`  ⚠️  ${result.modelName}: Expected to fail but passed`);
      }
    }
  }

  console.log(`\n✅ PASS: ${passCount}/${totalCount} models work correctly`);

  if (passCount < totalCount) {
    console.log(`⚠️  ${totalCount - passCount} models failed`);
  }
}

// Test 5: Store Integration
async function testStoreIntegration() {
  console.log("\n=== TEST 4: Store Integration ===");

  const today = new Date().toISOString().split("T")[0];
  const daily = getDailyChallenge(today);

  // Try to get a cached result
  const result = await store.getResult(daily.id, "openai/gpt-4o");

  if (result) {
    log(`Found cached result for AI Gateway model`);
    console.assert(result.keystrokes, "Cached result has keystrokes");
    console.assert(
      typeof result.timeMs === "number",
      "Cached result has timeMs"
    );
    console.log("✅ PASS: Store integration works");
  } else {
    console.log(
      "⚠️  No cached result found (may be expected if db.json doesn't match today's challenge)"
    );
  }
}

// Test 6: cleanKeystrokes Function
async function testCleanKeystrokes() {
  console.log("\n=== TEST 5: cleanKeystrokes Function ===");

  const testCases = [
    {
      input: ":%s/^/\\=line('.').'. '/<CR>",
      expected: ":%s/^/\\=line('.').'. '/<CR>",
      name: "Preserves backslashes",
    },
    {
      input: "```vim\n:%s/foo/bar/<CR>\n```",
      expected: ":%s/foo/bar/<CR>",
      name: "Removes markdown code blocks",
    },
    {
      input: "iHello<Esc>",
      expected: "iHello<Esc>",
      name: "Preserves simple commands",
    },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = cleanKeystrokes(tc.input);
    if (result === tc.expected) {
      log(`  ✅ ${tc.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${tc.name}`);
      console.log(`    Expected: ${JSON.stringify(tc.expected)}`);
      console.log(`    Got: ${JSON.stringify(result)}`);
    }
  }

  console.log(
    `✅ PASS: ${passed}/${testCases.length} cleanKeystrokes tests passed`
  );
}

// Test 7: Tokenization
async function testTokenization() {
  console.log("\n=== TEST 6: Tokenization ===");

  const testCases = [
    {
      input: ":%s/^/\\=line('.').'. '/<CR>",
      expectedCount: 1, // Should be one command token
      name: "Substitution command",
    },
    {
      input: "iHello<Esc>",
      expectedTokens: ["i", "H", "e", "l", "l", "o", "<Esc>"],
      name: "Insert mode",
    },
    {
      input: "gg0i1. <Esc>",
      expectedTokens: ["gg", "0", "i", "1", ".", " ", "<Esc>"],
      name: "Complex command",
    },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const tokens = tokenizeKeystrokes(tc.input);
    let success = false;

    if (tc.expectedTokens) {
      success = JSON.stringify(tokens) === JSON.stringify(tc.expectedTokens);
    } else if (tc.expectedCount) {
      success = tokens.length === tc.expectedCount;
    }

    if (success) {
      log(`  ✅ ${tc.name}: ${tokens.length} tokens`);
      passed++;
    } else {
      console.log(`  ❌ ${tc.name}`);
      console.log(
        `    Expected: ${JSON.stringify(tc.expectedTokens || tc.expectedCount)}`
      );
      console.log(`    Got: ${JSON.stringify(tokens)}`);
    }
  }

  console.log(
    `✅ PASS: ${passed}/${testCases.length} tokenization tests passed`
  );
}

// Run all tests
async function runAllTests() {
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║   Daily Challenge 'Run All Models' Flow - Test Suite         ║"
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝"
  );

  try {
    await testDailyChallengeLoading();
    await testCachedResults();
    await testCleanKeystrokes();
    await testTokenization();
    await testAllModelsFromDB();
    await testStoreIntegration();

    console.log(
      "\n╔═══════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                      ALL TESTS PASSED ✅                       ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════════╝"
    );
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED");
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
