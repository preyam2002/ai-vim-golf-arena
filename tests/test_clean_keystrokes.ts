import { cleanKeystrokes } from "./src/lib/ai-gateway";

console.log("=== Testing cleanKeystrokes function ===\n");

const testCases = [
  ":%s/^/\\=line('.').'. '/<CR>",
  ":%s/^/\\\\=line('.').'. '/<CR>",
  "```vim\n:%s/^/\\=line('.').'. '/<CR>\n```",
  "```\n:%s/^/\\=line('.').'. '/<CR>\n```",
];

for (const testCase of testCases) {
  console.log("Input:");
  console.log(JSON.stringify(testCase));
  const cleaned = cleanKeystrokes(testCase);
  console.log("Output:");
  console.log(JSON.stringify(cleaned));
  console.log("Has backslash before =?", cleaned.includes("\\="));
  console.log("---\n");
}
