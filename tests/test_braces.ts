import { createInitialState, executeKeystroke } from "../src/lib/vim-engine.ts";

const testText = `line1
line2
line3`;

console.log("Start:");
console.log(testText);

let state = createInitialState(testText);

// Add opening brace
state = executeKeystroke(state, "gg");
state = executeKeystroke(state, "O");
state = executeKeystroke(state, "{");
state = executeKeystroke(state, "<CR>");
state = executeKeystroke(state, "<Esc>");

console.log("\nAfter ggO{<CR><Esc>:");
console.log(state.lines.join("\n"));
console.log("Cursor at:", state.cursorLine, state.cursorCol);

// Add closing brace
state = executeKeystroke(state, "G");
state = executeKeystroke(state, "o");
state = executeKeystroke(state, "}");
state = executeKeystroke(state, "<Esc>");

console.log("\nAfter Go}<Esc>:");
console.log(state.lines.join("\n"));
console.log("Cursor at:", state.cursorLine, state.cursorCol);
