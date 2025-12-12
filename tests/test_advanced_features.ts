import {
  VimState,
  createInitialState,
  executeKeystroke,
} from "../src/lib/vim-engine";
import {
  buildCountPrefix,
  consumeCount,
  cycleIndex,
} from "../src/lib/vim-page-utils";

function runTest(
  name: string,
  initialLines: string[],
  sequence: string,
  expectedLines: string[],
  expectedCursor?: { line: number; col: number }
) {
  let state = createInitialState(initialLines.join("\n"));

  // Execute sequence
  // Handle <C-a> and <C-x> and <Esc>
  const tokens = sequence.split(/(<[^>]+>|.)/).filter(Boolean);

  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }

  // Verify lines
  const actualLines = state.lines;
  const linesMatch =
    JSON.stringify(actualLines) === JSON.stringify(expectedLines);

  if (!linesMatch) {
    console.error(`❌ Test '${name}' FAILED (Content mismatch)`);
    console.error(`  Expected: ${JSON.stringify(expectedLines)}`);
    console.error(`  Actual:   ${JSON.stringify(actualLines)}`);
  }

  // Verify cursor
  let cursorMatch = true;
  if (expectedCursor) {
    if (
      state.cursorLine !== expectedCursor.line ||
      state.cursorCol !== expectedCursor.col
    ) {
      cursorMatch = false;
      console.error(`❌ Test '${name}' FAILED (Cursor mismatch)`);
      console.error(
        `  Expected: ${expectedCursor.line}, ${expectedCursor.col}`
      );
      console.error(`  Actual:   ${state.cursorLine}, ${state.cursorCol}`);
    }
  }

  if (linesMatch && cursorMatch) {
    console.log(`✅ Test '${name}' PASSED`);
  }
}

console.log("Running Advanced Feature Tests...");

// Test 1: Case Change (gu, gU, g~)
runTest("gU (uppercase word)", ["hello world"], "gUw", ["HELLO world"], {
  line: 0,
  col: 0,
});

runTest("gu (lowercase word)", ["HELLO WORLD"], "guw", ["hello WORLD"], {
  line: 0,
  col: 0,
});

runTest("g~ (toggle case word)", ["Hello World"], "g~w", ["hELLO World"], {
  line: 0,
  col: 0,
});

runTest("gU (uppercase line)", ["hello world"], "gUgU", ["HELLO WORLD"], {
  line: 0,
  col: 0,
});

runTest("gUU (uppercase line alias)", ["hello world"], "gUU", ["HELLO WORLD"], {
  line: 0,
  col: 0,
});

runTest("guu (lowercase line alias)", ["HELLO WORLD"], "guu", ["hello world"], {
  line: 0,
  col: 0,
});

// Test 2: Number Operations (<C-a>, <C-x>)
runTest(
  "<C-a> (increment)",
  ["value: 10"],
  "<C-a>",
  ["value: 11"],
  { line: 0, col: 8 } // Cursor on last digit
);

runTest("<C-x> (decrement)", ["value: 10"], "<C-x>", ["value: 9"], {
  line: 0,
  col: 7,
});

runTest(
  "<C-a> (increment with search)",
  ["foo 99 bar"],
  "<C-a>",
  ["foo 100 bar"],
  { line: 0, col: 6 }
);

// Test 3: Line Change (cc)
runTest(
  "cc (change line)",
  ["line1", "line2", "line3"],
  "jccnew<Esc>",
  ["line1", "new", "line3"],
  { line: 1, col: 2 }
);

// Test 4: Character Find Repeat (;, ,)
runTest(
  "; (repeat find)",
  ["a.b.c.d.e"],
  "f.;",
  ["a.b.c.d.e"],
  { line: 0, col: 3 } // 2nd dot
);

runTest(
  ", (reverse repeat find)",
  ["a.b.c.d.e"],
  "$F.,",
  ["a.b.c.d.e"],
  { line: 0, col: 5 } // 2nd dot from end (c.d) -> wait, F. finds last dot (7), , repeats F backward -> finds next dot backward (5)
);

console.log("Running Global Nav Utility Tests...");

function assertEqual(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name} expected ${expected} got ${actual as string}`);
  }
}

assertEqual("count prefix builds digits", buildCountPrefix("", "3"), "3");
assertEqual("count prefix ignores leading zero", buildCountPrefix("", "0"), "");
assertEqual("consume count default", consumeCount("", 1), 1);
assertEqual("consume count numeric", consumeCount("12", 1), 12);
assertEqual("cycle index forward", cycleIndex(0, 1, 3), 1);
assertEqual("cycle index backward wraps", cycleIndex(0, -1, 3), 2);
