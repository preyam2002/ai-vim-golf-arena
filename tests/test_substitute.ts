import { createInitialState, executeKeystroke } from "./src/lib/vim-engine.ts";

const testText = `# API Settings
JOBS_API_URL=http://localhost:5000

# Database Settings
JOBS_DATABASE_URI=mongodb://mongouser`;

console.log("Original:");
console.log(testText);
console.log("\n---\n");

let state = createInitialState(testText);

// Sequence that should work:
// 1. Remove comment lines
state = executeKeystroke(state, ":%s/^#.*$//g<CR>");
console.log("After removing comments (leave blank lines):");
console.log(state.lines.join("\n"));
console.log("\n---\n");

// 2. Remove blank lines
state = executeKeystroke(state, ":%s/^$\\n//g<CR>");
console.log("After removing blank lines:");
console.log(state.lines.join("\n"));
