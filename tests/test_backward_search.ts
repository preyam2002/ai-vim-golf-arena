import { createInitialState, executeKeystroke } from "./src/lib/vim-engine.ts";

const testText = `line1
line2,
line3,
line4,`;

console.log("Test: Backward search for comma");
console.log("Text:");
console.log(testText);
console.log("\n---\n");

let state = createInitialState(testText);

// Go to end of file
state = executeKeystroke(state, "G");
console.log(
  `After G: cursor at line ${state.cursorLine}, col ${state.cursorCol}`
);

// Search backward for comma
state = executeKeystroke(state, "?");
state = executeKeystroke(state, ",");
state = executeKeystroke(state, "$");
state = executeKeystroke(state, "<CR>");

console.log(
  `After ?,$<CR>: cursor at line ${state.cursorLine}, col ${state.cursorCol}`
);
console.log(`Expected: line 2 (3rd line), col 5 (the comma)`);

// Now delete the character
state = executeKeystroke(state, "x");
console.log("\nAfter x:");
console.log(state.lines.join("\n"));
console.log("\nExpected: line3 should have no comma");
