import { createInitialState, executeKeystroke } from "./src/lib/vim-engine.ts";

const testText = `JOBS_API_URL=http://localhost:5000
JOBS_BASE_URL=http://localhost:8000
JOBS_DATABASE_URI=mongodb://mongouser`;

console.log("Start:");
console.log(testText);

let state = createInitialState(testText);

// Apply the substitution
state = executeKeystroke(
  state,
  `:%s/^\\([^=]*\\)=\\(.*\\)$/ \"\\1\": \"\\2\",/g<CR>`
);

console.log("\nAfter substitution:");
for (let i = 0; i < state.lines.length; i++) {
  console.log(`Line ${i}: "${state.lines[i]}"`);
}

// Now add braces
state = executeKeystroke(state, "gg");
state = executeKeystroke(state, "O");
state = executeKeystroke(state, "{");
state = executeKeystroke(state, "<CR>");
state = executeKeystroke(state, "<Esc>");

console.log("\nAfter adding opening brace:");
for (let i = 0; i < state.lines.length; i++) {
  console.log(`Line ${i}: "${state.lines[i]}"`);
}
