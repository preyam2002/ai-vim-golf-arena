import { createInitialState, executeKeystroke } from "../src/lib/vim-engine.ts";

const testText = `key1=value1
key2=value2
key3=value3`;

console.log("Test: Visual mode range substitution");
console.log("Text:");
console.log(testText);
console.log("\n---\n");

let state = createInitialState(testText);

// Visual select all lines: ggVG
state = executeKeystroke(state, "g");
state = executeKeystroke(state, "g");
state = executeKeystroke(state, "V");
state = executeKeystroke(state, "G");

console.log(
  `After ggVG: mode=${state.mode}, visualStart line=${state.visualStart?.line}, cursor line=${state.cursorLine}`
);

// Now run substitution with visual range: :'<,'>s/=/": "/g
const subCommand = ":'<,'>s/=/\": \"/g<CR>";
for (const char of subCommand.split("")) {
  if (char === "<") {
    state = executeKeystroke(state, "<CR>");
    break;
  }
  state = executeKeystroke(state, char);
}

// Complete the command properly
state = executeKeystroke(state, ":");
state = executeKeystroke(state, "'");
state = executeKeystroke(state, "<");
state = executeKeystroke(state, ",");
state = executeKeystroke(state, "'");
state = executeKeystroke(state, ">");
state = executeKeystroke(state, "s");
state = executeKeystroke(state, "/");
state = executeKeystroke(state, "=");
state = executeKeystroke(state, "/");
state = executeKeystroke(state, '"');
state = executeKeystroke(state, ":");
state = executeKeystroke(state, " ");
state = executeKeystroke(state, '"');
state = executeKeystroke(state, "/");
state = executeKeystroke(state, "g");
state = executeKeystroke(state, "<CR>");

console.log("\nAfter :'<,'>s/=/\": \"/g:");
console.log(state.lines.join("\n"));
console.log("\nExpected:");
console.log(`key1\": \"value1
key2\": \"value2
key3\": \"value3`);
