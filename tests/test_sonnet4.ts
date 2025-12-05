import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
} from "./src/lib/vim-engine";

console.log("=== Testing Claude Sonnet 4 Keystrokes ===\n");

// Exact data from static-1 challenge
const startText = "apple\nbanana\ncherry";
const targetText = "1. apple\n2. banana\n3. cherry";

// Test both versions of the keystrokes
const keystrokesWithSpace = ":%s/^/\\=line('.').'. '/<CR>";
const keystrokesWithoutSpace = ":%s/^/\\=line('.').'. '/<CR>";

console.log("Start Text:");
console.log(startText);
console.log("\nTarget Text:");
console.log(targetText);

// Test 1: WITH space (from your screenshot)
console.log("\n=== Test 1: Keystrokes WITH space in concatenation ===");
console.log(`Keystrokes: ${keystrokesWithSpace}`);

let state1 = createInitialState(startText);
const tokens1 = tokenizeKeystrokes(keystrokesWithSpace);
console.log("Tokens:", tokens1);

for (const token of tokens1) {
  state1 = executeKeystroke(state1, token);
}

const result1 = state1.lines.join("\n");
console.log("\nActual Output:");
console.log(result1);
console.log("\nExpected Output:");
console.log(targetText);
console.log("\nMatch:", result1 === targetText ? "✅ YES" : "❌ NO");

if (result1 !== targetText) {
  console.log("\nDifference:");
  console.log("Expected bytes:", Buffer.from(targetText));
  console.log("Actual bytes:  ", Buffer.from(result1));
}

// Test 2: WITHOUT space
console.log("\n\n=== Test 2: Keystrokes WITHOUT space in concatenation ===");
console.log(`Keystrokes: ${keystrokesWithoutSpace}`);

let state2 = createInitialState(startText);
const tokens2 = tokenizeKeystrokes(keystrokesWithoutSpace);
console.log("Tokens:", tokens2);

for (const token of tokens2) {
  state2 = executeKeystroke(state2, token);
}

const result2 = state2.lines.join("\n");
console.log("\nActual Output:");
console.log(result2);
console.log("\nExpected Output:");
console.log(targetText);
console.log("\nMatch:", result2 === targetText ? "✅ YES" : "❌ NO");

if (result2 !== targetText) {
  console.log("\nDifference:");
  console.log("Expected bytes:", Buffer.from(targetText));
  console.log("Actual bytes:  ", Buffer.from(result2));
}

// Determine which version works
console.log("\n=== SUMMARY ===");
if (result1 === targetText) {
  console.log("✅ Version WITH space works");
  process.exit(0);
} else if (result2 === targetText) {
  console.log("✅ Version WITHOUT space works");
  process.exit(0);
} else {
  console.log("❌ NEITHER version works - there's a bug in vim-engine");
  process.exit(1);
}
