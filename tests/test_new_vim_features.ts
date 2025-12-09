import {
  createInitialState,
  executeKeystroke,
  normalizeText,
} from "../src/lib/vim-engine";
import { VimState } from "../src/lib/vim-types";

function runTest(
  name: string,
  startText: string,
  keystrokes: string,
  expectedText: string
) {
  console.log(`\nRunning test: ${name}`);
  let state = createInitialState(startText);

  // Tokenize (simple)
  const tokens: string[] = [];
  let i = 0;
  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i);
      if (end !== -1) {
        tokens.push(keystrokes.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    tokens.push(keystrokes[i]);
    i++;
  }

  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }

  const result = state.lines.join("\n");
  const normalizedResult = normalizeText(result);
  const normalizedExpected = normalizeText(expectedText);

  if (normalizedResult === normalizedExpected) {
    console.log("✅ PASS");
  } else {
    console.log("❌ FAIL");
    console.log("Expected:");
    console.log(normalizedExpected);
    console.log("Actual:");
    console.log(normalizedResult);
  }
}

// 1. Paste (p)
runTest(
  "Paste (yy p)",
  "line 1\nline 2",
  "yyjjp", // yy (yank line 1), j (move to line 2), p (paste below) -> line 1, line 2, line 1
  "line 1\nline 2\nline 1"
);

// 2. Dot Repeat (.)
runTest(
  "Dot Repeat (dd .)",
  "line 1\nline 2\nline 3\nline 4",
  "ddj.", // dd (delete line 1), j (move to line 3 - now line 2), . (delete line 3 - now line 2) -> line 2, line 4
  "line 2\nline 4"
);

// 3. Find Repeat (;)
runTest(
  "Find Repeat (fa ;)",
  "banana",
  "fa;", // f a (find first a), ; (find next a) -> cursor on second a (index 3)
  "banana" // Text doesn't change, but we check cursor?
  // Let's use x to verify cursor position
);

runTest(
  "Find Repeat with Action (fa ; x)",
  "banana",
  "fa;x", // f a (find first a), ; (find next a), x (delete it) -> banna
  "banna"
);

// Debug specific test
{
  console.log("\nDEBUG: Find Repeat with Action");
  let state = createInitialState("banana");
  const steps = ["f", "a", ";", "x"];
  for (const step of steps) {
    state = executeKeystroke(state, step);
    console.log(
      `Step ${step}: Cursor at ${state.cursorLine}:${state.cursorCol}, Line: ${
        state.lines[0]
      }, lastFindChar: ${JSON.stringify(state.lastFindChar)}`
    );
  }
}

// 4. Join (J)
runTest("Join (J)", "line 1\nline 2", "J", "line 1 line 2");

runTest(
  "Join without space (gJ)",
  "line1\n\nline2",
  "j$gJ",
  "line1\nline2"
);

// 5. Toggle Case (~)
runTest(
  "Toggle Case (~)",
  "Hello",
  "~", // H -> h, cursor moves to e
  "hello"
);

runTest(
  "Toggle Case Multiple (~~~)",
  "Hello",
  "~~~", // H->h, e->E, l->L -> hELlo
  "hELlo"
);

// 6. Shortcuts (D)
runTest(
  "Shortcut D (D)",
  "Hello World",
  "wD", // w (move to World), D (delete to end) -> Hello
  "Hello "
);

// 7. Redo (<C-r>)
runTest(
  "Redo (<C-r>)",
  "Hello",
  "xux<C-r>", // x (delete H -> ello), u (undo -> Hello), x (delete H -> ello), <C-r> (redo? No wait)
  // u undoes the last change.
  // x (change 1). u (undo change 1). State is Hello.
  // x (change 2). State is ello.
  // <C-r> (redo). Redo stack is empty because we made a new change!
  // Correct sequence: x u <C-r>
  // x (ello). u (Hello). <C-r> (ello).
  "ello"
);

runTest("Redo Sequence (x u <C-r>)", "Hello", "xu<C-r>", "ello");

// 8. Undo Line (U)
runTest(
  "Undo Line (U)",
  "Hello World",
  "xwxU", // x (ello World), w (move to World), x (ello orld), U (undo all on line -> Hello World)
  "Hello World"
);

// 9. Dot Repeat with Insert
runTest(
  "Dot Repeat Insert (A...<Esc> j .)",
  "line 1\nline 2",
  "A added<Esc>j.", // Append " added" to line 1. Move to line 2. Repeat -> Append " added" to line 2.
  "line 1 added\nline 2 added"
);

// 10. Word Search (*)
runTest(
  "Word Search (*)",
  "word other word",
  "*", // Cursor starts at 0,0 (on 'w'). * should jump to next 'word' at index 11.
  "word other word" // Text doesn't change
);
// We need to verify cursor position for * and %.
// runTest currently only checks text content.
// Let's add a test that modifies text after jump to verify position.

// Debug Word Search
{
  console.log("\nDEBUG: Word Search");
  let state = createInitialState("word other word");
  // * should jump to next 'word'
  state = executeKeystroke(state, "*");
  console.log(`Step *: Cursor at ${state.cursorLine}:${state.cursorCol}`);
  state = executeKeystroke(state, "c");
  state = executeKeystroke(state, "w");
  state = executeKeystroke(state, "T");
  state = executeKeystroke(state, "E");
  state = executeKeystroke(state, "S");
  state = executeKeystroke(state, "T");
  state = executeKeystroke(state, "<Esc>");
  console.log(`Final Line: ${state.lines[0]}`);
}

runTest(
  "Word Search with Action (* cw)",
  "word other word",
  "*cwTEST<Esc>", // * jumps to second word. cw changes it to TEST.
  "word other TEST"
);

// 11. Bracket Jump (%)
// Debug Bracket Jump
{
  console.log("\nDEBUG: Bracket Jump");
  let state = createInitialState("if (condition) {");
  const steps = ["l", "l", "l", "%", "r", "X"];
  for (const step of steps) {
    state = executeKeystroke(state, step);
    console.log(
      `Step ${step}: Cursor at ${state.cursorLine}:${state.cursorCol}, Line: ${state.lines[0]}`
    );
  }
}

runTest(
  "Bracket Jump (%)",
  "if (condition) {",
  "lll%rX", // lll to '(', % to ')', rX to replace ')' with 'X'
  "if (conditionX {"
);

// 12. Number Increment (<C-a>)
runTest(
  "Number Increment (<C-a>)",
  "count: 10",
  "<C-a>", // Should find 10 and increment to 11
  "count: 11"
);

// 13. Number Decrement (<C-x>)
runTest(
  "Number Decrement (<C-x>)",
  "count: 10",
  "<C-x>", // Should find 10 and decrement to 9
  "count: 9"
);
