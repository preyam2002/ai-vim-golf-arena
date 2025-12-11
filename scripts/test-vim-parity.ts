#!/usr/bin/env npx tsx
/**
 * Test vim engine parity against real nvim
 * Runs test cases through both engines and reports mismatches
 */

import { runVimParity } from "../src/lib/vim-parity";

interface TestCase {
  name: string;
  startText: string;
  keystrokes: string;
  expectedText: string;
  initialCursor?: { line: number; col: number };
}

// Test cases extracted from vim-engine.test.ts plus additional edge cases
const testCases: TestCase[] = [
  // Basic motions
  {
    name: "h motion",
    startText: "hello",
    keystrokes: "llh",
    expectedText: "hello",
  },
  {
    name: "j motion",
    startText: "a\nb\nc",
    keystrokes: "jj",
    expectedText: "a\nb\nc",
  },
  {
    name: "k motion",
    startText: "a\nb\nc",
    keystrokes: "jjk",
    expectedText: "a\nb\nc",
  },
  {
    name: "l motion",
    startText: "hello",
    keystrokes: "ll",
    expectedText: "hello",
  },
  {
    name: "w motion",
    startText: "hello world",
    keystrokes: "wdw",
    expectedText: "hello ",
  },
  {
    name: "b motion",
    startText: "hello world",
    keystrokes: "$bdw",
    expectedText: "hello ",
  },
  {
    name: "e motion",
    startText: "hello world",
    keystrokes: "ede",
    expectedText: "hell",
  },
  {
    name: "0 motion",
    startText: "  hello",
    keystrokes: "$0x",
    expectedText: " hello",
  },
  {
    name: "$ motion",
    startText: "hello",
    keystrokes: "$x",
    expectedText: "hell",
  },
  {
    name: "^ motion",
    startText: "  hello",
    keystrokes: "$^x",
    expectedText: "  ello",
  },
  {
    name: "gg motion",
    startText: "a\nb\nc",
    keystrokes: "Gggx",
    expectedText: "\nb\nc",
  },
  {
    name: "G motion",
    startText: "a\nb\nc",
    keystrokes: "Gx",
    expectedText: "a\nb\n",
  },

  // Delete operations
  {
    name: "x delete",
    startText: "hello",
    keystrokes: "x",
    expectedText: "ello",
  },
  {
    name: "X backspace",
    startText: "hello",
    keystrokes: "lX",
    expectedText: "ello",
  },
  {
    name: "dw delete word",
    startText: "hello world",
    keystrokes: "dw",
    expectedText: "world",
  },
  {
    name: "dd delete line",
    startText: "a\nb\nc",
    keystrokes: "dd",
    expectedText: "b\nc",
  },
  {
    name: "D delete to end",
    startText: "hello world",
    keystrokes: "D",
    expectedText: "",
  },
  {
    name: "d$ delete to end",
    startText: "hello world",
    keystrokes: "ld$",
    expectedText: "h",
  },
  {
    name: "d0 delete to start",
    startText: "hello",
    keystrokes: "$d0",
    expectedText: "o",
  },
  {
    name: "dj delete down",
    startText: "a\nb\nc",
    keystrokes: "dj",
    expectedText: "c",
  },
  {
    name: "dk delete up",
    startText: "a\nb\nc",
    keystrokes: "jdk",
    expectedText: "c",
  },
  {
    name: "dt delete till",
    startText: "ae",
    keystrokes: "dte",
    expectedText: "e",
  },
  {
    name: "df delete find",
    startText: "ae",
    keystrokes: "dfe",
    expectedText: "",
  },
  {
    name: "d} delete paragraph",
    startText: "a\n\nb",
    keystrokes: "d}",
    expectedText: "\nb",
  },

  // Change operations
  {
    name: "cw change word",
    startText: "hello world",
    keystrokes: "cwX<Esc>",
    expectedText: "X world",
  },
  {
    name: "cc change line",
    startText: "hello\nworld",
    keystrokes: "ccX<Esc>",
    expectedText: "X\nworld",
  },
  {
    name: "C change to end",
    startText: "hello",
    keystrokes: "lCX<Esc>",
    expectedText: "hX",
  },
  {
    name: "ciw change inner word",
    startText: "hello world",
    keystrokes: "ciwX<Esc>",
    expectedText: "X world",
  },
  {
    name: "ci( change in parens",
    startText: "(hello)",
    keystrokes: "ci(X<Esc>",
    expectedText: "(X)",
  },
  {
    name: 'ci" change in quotes',
    startText: '"hello"',
    keystrokes: 'ci"X<Esc>',
    expectedText: '"X"',
  },

  // Insert operations
  {
    name: "i insert",
    startText: "hello",
    keystrokes: "iX<Esc>",
    expectedText: "Xhello",
  },
  {
    name: "I insert line start",
    startText: "  hello",
    keystrokes: "IX<Esc>",
    expectedText: "  Xhello",
  },
  {
    name: "a append",
    startText: "hello",
    keystrokes: "aX<Esc>",
    expectedText: "hXello",
  },
  {
    name: "A append end",
    startText: "hello",
    keystrokes: "AX<Esc>",
    expectedText: "helloX",
  },
  {
    name: "o open below",
    startText: "hello",
    keystrokes: "oX<Esc>",
    expectedText: "hello\nX",
  },
  {
    name: "O open above",
    startText: "hello",
    keystrokes: "OX<Esc>",
    expectedText: "X\nhello",
  },

  // Yank and paste
  {
    name: "yy yank line",
    startText: "a\nb",
    keystrokes: "yyp",
    expectedText: "a\na\nb",
  },
  {
    name: "yw yank word",
    startText: "hello world",
    keystrokes: "ywwP",
    expectedText: "hello hello world",
  },
  {
    name: "p paste after",
    startText: "hello",
    keystrokes: "xp",
    expectedText: "ehllo",
  },
  {
    name: "P paste before",
    startText: "hello",
    keystrokes: "xP",
    expectedText: "hello",
  },
  {
    name: "dd then p",
    startText: "a\nb",
    keystrokes: "ddp",
    expectedText: "b\na",
  },

  // Visual mode
  {
    name: "v visual select",
    startText: "hello",
    keystrokes: "vllx",
    expectedText: "lo",
  },
  {
    name: "V visual line",
    startText: "a\nb\nc",
    keystrokes: "Vd",
    expectedText: "b\nc",
  },
  {
    name: "visual change",
    startText: "abcde",
    keystrokes: "vllcX<Esc>",
    expectedText: "Xde",
  },

  // Visual block
  {
    name: "block delete",
    startText: "aaa\nbbb\nccc",
    keystrokes: "<C-v>jjlx",
    expectedText: "a\nb\nc",
  },
  {
    name: "block append",
    startText: "let x = 1\nlet y = 2\nlet z = 3",
    keystrokes: "<C-v>G$A;<Esc>",
    expectedText: "let x = 1;\nlet y = 2;\nlet z = 3;",
  },

  // Case operations
  { name: "~ toggle case", startText: "a", keystrokes: "~", expectedText: "A" },
  {
    name: "gU uppercase",
    startText: "hello",
    keystrokes: "gUw",
    expectedText: "HELLO",
  },
  {
    name: "gu lowercase",
    startText: "HELLO",
    keystrokes: "guw",
    expectedText: "hello",
  },
  {
    name: "gUG uppercase to end",
    startText: "one\ntwo\nthree",
    keystrokes: "jgUG",
    expectedText: "one\nTWO\nTHREE",
  },
  {
    name: "gUU uppercase line",
    startText: "hello",
    keystrokes: "gUU",
    expectedText: "HELLO",
  },
  {
    name: "guu lowercase line",
    startText: "HELLO",
    keystrokes: "guu",
    expectedText: "hello",
  },

  // Replace
  {
    name: "r replace char",
    startText: "hello",
    keystrokes: "rX",
    expectedText: "Xello",
  },
  {
    name: "R replace mode",
    startText: "hello",
    keystrokes: "RXY<Esc>",
    expectedText: "XYllo",
  },

  // Repeat and undo
  {
    name: ". repeat",
    startText: "hello world",
    keystrokes: "dw.",
    expectedText: "",
  },
  {
    name: "u undo",
    startText: "hello",
    keystrokes: "xu",
    expectedText: "hello",
  },
  {
    name: "C-r redo",
    startText: "hello",
    keystrokes: "xu<C-r>",
    expectedText: "ello",
  },

  // Indent
  {
    name: ">> indent",
    startText: "a\nb",
    keystrokes: "j>>",
    expectedText: "a\n  b",
  },
  {
    name: "<< dedent",
    startText: "a\n  b",
    keystrokes: "j<<",
    expectedText: "a\nb",
  },

  // Join
  { name: "J join", startText: "a\nb", keystrokes: "J", expectedText: "a b" },

  // Search
  {
    name: "/ search",
    startText: "foo bar foo",
    keystrokes: "/foo<CR>nciw<Esc>",
    expectedText: " bar foo",
  },
  {
    name: "* word search",
    startText: "foo bar foo",
    keystrokes: "*cwX<Esc>",
    expectedText: "foo bar X",
  },
  {
    name: "n next match",
    startText: "foo bar foo",
    keystrokes: "/foo<CR>nx",
    expectedText: "oo bar foo",
  },

  // Find motions
  {
    name: "f find",
    startText: "hello",
    keystrokes: "fld",
    expectedText: "heo",
  },
  {
    name: "F find back",
    startText: "hello",
    keystrokes: "$Flx",
    expectedText: "helo",
  },
  {
    name: "t till",
    startText: "hello",
    keystrokes: "tlx",
    expectedText: "hllo",
  },
  {
    name: "T till back",
    startText: "hello",
    keystrokes: "$Tlx",
    expectedText: "helo",
  },
  {
    name: "; repeat find",
    startText: "ababa",
    keystrokes: "fb;x",
    expectedText: "abaa",
  },
  {
    name: ", reverse find",
    startText: "ababa",
    keystrokes: "fb;,x",
    expectedText: "aaba",
  },

  // Text objects
  {
    name: "diw delete inner word",
    startText: "hello world",
    keystrokes: "diw",
    expectedText: " world",
  },
  {
    name: "daw delete a word",
    startText: "hello world",
    keystrokes: "daw",
    expectedText: "world",
  },
  {
    name: "di( delete in parens",
    startText: "(hello)",
    keystrokes: "di(",
    expectedText: "()",
  },
  {
    name: "da( delete a parens",
    startText: "(hello)",
    keystrokes: "da(",
    expectedText: "",
  },
  {
    name: 'di" delete in quotes',
    startText: '"hello"',
    keystrokes: 'di"',
    expectedText: '""',
  },
  {
    name: 'da" delete a quotes',
    startText: '"hello"',
    keystrokes: 'da"',
    expectedText: "",
  },
  {
    name: "di{ delete in braces",
    startText: "{hello}",
    keystrokes: "di{",
    expectedText: "{}",
  },
  {
    name: "dip delete inner para",
    startText: "a\n\nb",
    keystrokes: "dip",
    expectedText: "\nb",
  },
  {
    name: "dap delete a para",
    startText: "one\n\nTwo\nThree",
    keystrokes: "dap",
    expectedText: "Two\nThree",
  },

  // Substitution
  {
    name: ":s substitute",
    startText: "hello world",
    keystrokes: ":s/hello/bye/<CR>",
    expectedText: "bye world",
  },
  {
    name: ":%s global sub",
    startText: "let x = 1\nlet y = 2\nlet z = 3",
    keystrokes: ":%s/$/;/<CR>",
    expectedText: "let x = 1;\nlet y = 2;\nlet z = 3;",
  },
  {
    name: ":s with &",
    startText: "apple banana cherry",
    keystrokes: ':%s/\\w\\+/"&"/g<CR>',
    expectedText: '"apple" "banana" "cherry"',
  },

  // Global command
  {
    name: ":g/^$/d delete blank",
    startText: "a\n\nb\n\nc",
    keystrokes: ":g/^$/d<CR>",
    expectedText: "a\nb\nc",
  },
  {
    name: ":g/^/m0 reverse",
    startText: "first\nsecond\nthird\nfourth",
    keystrokes: ":g/^/m0<CR>",
    expectedText: "fourth\nthird\nsecond\nfirst",
  },
  {
    name: ":v/./d delete non-match",
    startText: "line1\n\nline2\n\n\nline3",
    keystrokes: ":v/./d<CR>",
    expectedText: "line1\nline2\nline3",
  },

  // Macros
  {
    name: "qa macro",
    startText: "a\nb\nc",
    keystrokes: "qaI-<Esc>jq@a",
    expectedText: "-a\n-b\nc",
  },

  // Registers
  {
    name: "named register",
    startText: "hello",
    keystrokes: '"aywdd"aP',
    expectedText: "hello",
  },

  // Marks
  {
    name: "mark and jump",
    startText: "a\nb\nc",
    keystrokes: "jmajk`ax",
    expectedText: "a\n\nc",
  },

  // Counts
  {
    name: "3x delete 3",
    startText: "hello",
    keystrokes: "3x",
    expectedText: "lo",
  },
  {
    name: "2dd delete 2 lines",
    startText: "a\nb\nc",
    keystrokes: "2dd",
    expectedText: "c",
  },
  {
    name: "3j move down 3",
    startText: "a\nb\nc\nd",
    keystrokes: "3jx",
    expectedText: "a\nb\nc\n",
  },

  // Combined operations
  {
    name: "swap chars xp",
    startText: "ab",
    keystrokes: "xp",
    expectedText: "ba",
  },
  {
    name: "dwA combo",
    startText: "one two three",
    keystrokes: "dwA!<Esc>",
    expectedText: "two three!",
  },
  {
    name: "yy then P",
    startText: "first\nsecond",
    keystrokes: "yyP",
    expectedText: "first\nfirst\nsecond",
  },
  {
    name: "5<C-a> increment",
    startText: "x1",
    keystrokes: "5<C-a>",
    expectedText: "x6",
  },
  {
    name: "append repeat",
    startText: "a\nb",
    keystrokes: "A1<Esc>j.",
    expectedText: "a1\nb1",
  },

  // Edge cases
  {
    name: "empty line delete",
    startText: "\n\n",
    keystrokes: "dd",
    expectedText: "\n",
  },
  {
    name: "single char file",
    startText: "x",
    keystrokes: "x",
    expectedText: "",
  },
  {
    name: "cursor bounds",
    startText: "ab",
    keystrokes: "$x",
    expectedText: "a",
  },

  // Expression substitution
  {
    name: "expression sub",
    startText: "a\nb\nc",
    keystrokes: ":%s/^/\\=line('.') . '. '/<CR>",
    expectedText: "1. a\n2. b\n3. c",
  },

  // Multi-digit backreference
  {
    name: "multi-digit backref",
    startText: "abcdefghij",
    keystrokes:
      ":%s/\\v(.)(.)(.)(.)(.)(.)(.)(.)(.)(.)/\\10\\9\\8\\7\\6\\5\\4\\3\\2\\1/<CR>",
    expectedText: "jihgfedcba",
  },

  // Nested tag object
  {
    name: "cit tag object",
    startText: "<div>content</div>",
    keystrokes: "f>lcit<Esc>",
    expectedText: "<div></div>",
  },
];

interface TestResult {
  name: string;
  passed: boolean;
  engineResult: string;
  vimResult: string;
  expected: string;
  engineMatchesExpected: boolean;
  vimMatchesExpected: boolean;
  error?: string;
}

async function main() {
  const results: TestResult[] = [];
  const filter = process.argv[2]; // optional filter

  console.log("Running vim parity tests...\n");

  for (const tc of testCases) {
    if (filter && !tc.name.toLowerCase().includes(filter.toLowerCase())) {
      continue;
    }

    try {
      const parity = runVimParity({
        startText: tc.startText,
        keystrokes: tc.keystrokes,
        expectedText: tc.expectedText,
        initialState: tc.initialCursor
          ? {
              cursorLine: tc.initialCursor.line,
              cursorCol: tc.initialCursor.col,
            }
          : undefined,
      });

      const passed = parity.engineNormalized === parity.vimNormalized;
      const engineMatchesExpected =
        parity.expectedNormalized === undefined ||
        parity.engineNormalized === parity.expectedNormalized;
      const vimMatchesExpected =
        parity.expectedNormalized === undefined ||
        parity.vimNormalized === parity.expectedNormalized;

      results.push({
        name: tc.name,
        passed,
        engineResult: parity.engineNormalized,
        vimResult: parity.vimNormalized,
        expected: parity.expectedNormalized ?? tc.expectedText ?? "",
        engineMatchesExpected,
        vimMatchesExpected,
      });

      const status = passed ? "✓" : "✗";
      const details = passed
        ? ""
        : ` [engine=${engineMatchesExpected ? "OK" : "WRONG"}, vim=${
            vimMatchesExpected ? "OK" : "WRONG"
          }]`;
      console.log(`${status} ${tc.name}${details}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: tc.name,
        passed: false,
        engineResult: "",
        vimResult: "",
        expected: tc.expectedText ?? "",
        engineMatchesExpected: false,
        vimMatchesExpected: false,
        error: message,
      });
      console.log(`✗ ${tc.name} [error: ${message}]`);
    }
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Results: ${passedCount} passed, ${failedCount} failed out of ${results.length} tests`
  );

  // Show failures in detail
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("FAILURES:\n");

    for (const f of failures) {
      console.log(`--- ${f.name} ---`);
      console.log(
        `Keystrokes: ${testCases.find((tc) => tc.name === f.name)?.keystrokes}`
      );
      console.log(
        `Start:    "${testCases
          .find((tc) => tc.name === f.name)
          ?.startText.replace(/\n/g, "\\n")}"`
      );
      console.log(
        `Expected: "${f.expected.replace(/\n/g, "\\n")}" ${
          f.vimMatchesExpected ? "(vim OK)" : "(vim wrong)"
        }`
      );
      console.log(
        `Engine:   "${f.engineResult.replace(/\n/g, "\\n")}" ${
          f.engineMatchesExpected ? "(matches expected)" : "(WRONG)"
        }`
      );
      console.log(
        `Vim:      "${f.vimResult.replace(/\n/g, "\\n")}" ${
          f.vimMatchesExpected ? "(matches expected)" : "(WRONG)"
        }`
      );
      if (f.error) console.log(`Error:    ${f.error}`);
      console.log();
    }
  }

  // Exit with error code if failures
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
