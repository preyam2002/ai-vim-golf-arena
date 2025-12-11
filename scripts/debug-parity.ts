import { runVimParity } from "../src/lib/vim-parity";

const tests = [
  // Basic motions
  { name: "h motion", startText: "hello", keystrokes: "llh", expectedText: "hello" },
  { name: "l motion", startText: "hello", keystrokes: "lll", expectedText: "hello" },
  { name: "w motion", startText: "hello world", keystrokes: "w", expectedText: "hello world" },
  { name: "b motion", startText: "hello world", keystrokes: "wb", expectedText: "hello world" },
  { name: "e motion", startText: "hello world", keystrokes: "e", expectedText: "hello world" },
  { name: "0 motion", startText: "hello world", keystrokes: "ll0", expectedText: "hello world" },
  { name: "$ motion", startText: "hello world", keystrokes: "$", expectedText: "hello world" },
  { name: "^ motion", startText: "  hello", keystrokes: "^", expectedText: "  hello" },

  // Delete operations
  { name: "x delete", startText: "hello", keystrokes: "x", expectedText: "ello" },
  { name: "X delete", startText: "hello", keystrokes: "lX", expectedText: "ello" },
  { name: "dw delete", startText: "hello world", keystrokes: "dw", expectedText: "world" },
  { name: "de delete", startText: "hello world", keystrokes: "de", expectedText: " world" },
  { name: "db delete", startText: "hello world", keystrokes: "wdb", expectedText: "world" },
  { name: "dd delete", startText: "line1\nline2", keystrokes: "dd", expectedText: "line2" },
  { name: "D delete to EOL", startText: "hello world", keystrokes: "llD", expectedText: "he" },
  { name: "d$ delete", startText: "hello world", keystrokes: "lld$", expectedText: "he" },
  { name: "d0 delete", startText: "hello world", keystrokes: "lld0", expectedText: "llo world" },

  // Change operations
  { name: "cw change", startText: "hello world", keystrokes: "cwX<Esc>", expectedText: "X world" },
  { name: "ce change", startText: "hello world", keystrokes: "ceX<Esc>", expectedText: "X world" },
  { name: "cc change line", startText: "hello world", keystrokes: "ccX<Esc>", expectedText: "X" },
  { name: "C change to EOL", startText: "hello world", keystrokes: "llCX<Esc>", expectedText: "heX" },
  { name: "s substitute", startText: "hello", keystrokes: "sX<Esc>", expectedText: "Xello" },
  { name: "S substitute line", startText: "hello", keystrokes: "SX<Esc>", expectedText: "X" },

  // Insert operations
  { name: "i insert", startText: "hello", keystrokes: "liX<Esc>", expectedText: "hXello" },
  { name: "I insert BOL", startText: "hello", keystrokes: "llIX<Esc>", expectedText: "Xhello" },
  { name: "a append", startText: "hello", keystrokes: "laX<Esc>", expectedText: "heXllo" },
  { name: "A append EOL", startText: "hello", keystrokes: "AX<Esc>", expectedText: "helloX" },
  { name: "o open below", startText: "hello", keystrokes: "oX<Esc>", expectedText: "hello\nX" },
  { name: "O open above", startText: "hello", keystrokes: "OX<Esc>", expectedText: "X\nhello" },

  // Replace
  { name: "r replace", startText: "hello", keystrokes: "rX", expectedText: "Xello" },

  // Yank/Paste
  { name: "yw yank word", startText: "hello world", keystrokes: "ywwP", expectedText: "hello hello world" },
  { name: "yy yank line", startText: "line1\nline2", keystrokes: "yyjp", expectedText: "line1\nline2\nline1" },
  { name: "p paste after", startText: "hello", keystrokes: "xlp", expectedText: "ehllo" },
  { name: "P paste before", startText: "hello", keystrokes: "xlP", expectedText: "hello" },

  // Visual mode
  { name: "v visual delete", startText: "hello", keystrokes: "vlld", expectedText: "lo" },
  { name: "V visual line delete", startText: "line1\nline2", keystrokes: "Vd", expectedText: "line2" },

  // Text objects
  { name: "diw delete inner word", startText: "hello world", keystrokes: "ldiw", expectedText: " world" },
  { name: "daw delete around word", startText: "hello world", keystrokes: "ldaw", expectedText: "world" },
  { name: "di( delete inner parens", startText: "(hello)", keystrokes: "ldi(", expectedText: "()" },
  { name: "da( delete around parens", startText: "(hello)", keystrokes: "lda(", expectedText: "" },

  // Case operations
  { name: "~ toggle case", startText: "Hello", keystrokes: "~", expectedText: "hello" },
  { name: "gUw uppercase word", startText: "hello world", keystrokes: "gUw", expectedText: "HELLO world" },
  { name: "guw lowercase word", startText: "HELLO WORLD", keystrokes: "guw", expectedText: "hello WORLD" },

  // Repeat
  { name: ". repeat", startText: "hello hello", keystrokes: "cwX<Esc>w.", expectedText: "X X" },

  // Join
  { name: "J join lines", startText: "hello\nworld", keystrokes: "J", expectedText: "hello world" },

  // Undo/Redo
  { name: "u undo", startText: "hello", keystrokes: "xu", expectedText: "hello" },
  { name: "<C-r> redo", startText: "hello", keystrokes: "xu<C-r>", expectedText: "ello" },

  // Search
  { name: "f find char", startText: "hello", keystrokes: "fld", expectedText: "helo" },
  { name: "t till char", startText: "hello", keystrokes: "tld", expectedText: "hllo" },

  // Increment/Decrement
  { name: "<C-a> increment", startText: "x1y", keystrokes: "l<C-a>", expectedText: "x2y" },
  { name: "<C-x> decrement", startText: "x5y", keystrokes: "l<C-x>", expectedText: "x4y" },
];

for (const t of tests) {
  try {
    const result = runVimParity({
      startText: t.startText,
      keystrokes: t.keystrokes,
      expectedText: t.expectedText,
    });
    const match = result.engineNormalized === result.vimNormalized;
    console.log(`${match ? '✓' : '✗'} ${t.name}`);
    if (!match) {
      console.log(`  Engine: "${result.engineNormalized}"`);
      console.log(`  Vim:    "${result.vimNormalized}"`);
    }
  } catch (err) {
    console.log(`✗ ${t.name}: ${err instanceof Error ? err.message : err}`);
  }
}
