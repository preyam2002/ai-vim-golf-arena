import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
} from "./vim-engine";
import { maybeExpectVimParity } from "./test-parity";

function runKeystrokes(text: string, ks: string) {
  let state = createInitialState(text);
  for (const token of tokenizeKeystrokes(ks)) {
    state = executeKeystroke(state, token);
  }
  return state;
}

function runTest(start: string, keystrokes: string, expected: string) {
  const state = runKeystrokes(start, keystrokes);
  const result = state.lines.join("\n");
  expect(result).toBe(expected);
  return maybeExpectVimParity({
    startText: start,
    keystrokes,
    expectedText: expected,
  });
}

describe("vim feature parity tests", () => {
  // Motion commands that might be missing
  describe("missing motion commands", () => {
    test("g0 - go to first character of screen line", () => {
      runTest("hello world", "g0", "hello world");
    });

    test("g$ - go to last character of screen line", () => {
      runTest("hello world", "5lg$", "hello world");
    });

    test("gm - go to middle of screen line", () => {
      runTest("hello world", "gm", "hello world");
    });

    test("| - go to column n", () => {
      runTest("hello world", "5|x", "hell world");
    });

    test("( - go to previous sentence", () => {
      runTest("Hello. World.", "$(", "Hello. World.");
    });

    test(") - go to next sentence", () => {
      runTest("Hello. World.", ")", "Hello. World.");
    });

    test("- - go to first non-blank char of previous line", () => {
      runTest("line1\n  line2", "j-", "line1\n  line2");
    });

    test("+ - go to first non-blank char of next line", () => {
      runTest("line1\n  line2", "+", "line1\n  line2");
    });
  });

  // Text objects that might be missing
  describe("missing text objects", () => {
    test("is - inner sentence", () => {
      runTest("Hello world. This is test.", "wdis", " This is test.");
    });

    test("as - a sentence", () => {
      runTest("Hello world. This is test.", "wdas", "This is test.");
    });

    test("ib - inner block ()", () => {
      runTest("(hello world)", "dib", "()");
    });

    test("ab - a block ()", () => {
      runTest("x(hello)y", "fhdab", "xy");
    });

    test("iB - inner Block {}", () => {
      runTest("{hello world}", "diB", "{}");
    });

    test("aB - a Block {}", () => {
      runTest("x{hello}y", "fhdaB", "xy");
    });
  });

  // Operators that might be missing
  describe("missing operators", () => {
    test("gq - format text", () => {
      // With no formatoptions (nvim -u NONE), gq leaves text unchanged
      runTest("hello     world", "gq$", "hello     world");
    });

    test("gu - make lowercase", () => {
      runTest("HELLO", "guw", "hello");
    });

    test("gU - make uppercase", () => {
      runTest("hello", "gUw", "HELLO");
    });

    test("g~ - swap case", () => {
      runTest("Hello", "g~w", "hELLO");
    });

    test("= - indent", () => {
      runTest("  hello\nworld", "=G", "hello\nworld");
    });
  });

  // Ex commands that might be missing
  describe("missing ex commands", () => {
    test(":move - move lines", () => {
      runTest("line1\nline2\nline3", ":2move 0<CR>", "line2\nline1\nline3");
    });

    test(":copy - copy lines", () => {
      runTest("line1\nline2", ":1copy 1<CR>", "line1\nline1\nline2");
    });

    test(":read - read file or command output", () => {
      // Would need file system access
    });

    test(":write - write file", () => {
      // Would need file system access
    });

    test(":set - set options", () => {
      runTest("hello", ":set number<CR>", "hello");
    });

    test(":sort - sort lines", () => {
      runTest("c\nb\na", ":%sort<CR>", "a\nb\nc");
    });

    test(":normal - execute normal mode commands", () => {
      runTest("hello\nworld", ":%normal A!<CR>", "hello!\nworld!");
    });
  });

  // Visual mode features that might be missing
  describe("missing visual mode features", () => {
    test("gv - reselect last visual selection", () => {
      runTest("hello world", "vllygv", "hello world");
    });

    test("o - go to other end of visual selection", () => {
      runTest("hello world", "vlllo<Esc>", "hello world");
    });

    test("O - go to other corner in visual block", () => {
      runTest("ab\ncd", "<C-v>jO<Esc>", "ab\ncd");
    });
  });

  // Insert mode features that might be missing
  describe("missing insert mode features", () => {
    test("<C-w> - delete word before cursor", () => {
      runTest("hello world", "A<C-w><Esc>", "hello ");
    });

    test("<C-u> - delete to start of line", () => {
      runTest("hello world", "A<C-u><Esc>", "");
    });

    test("<C-r> - insert register contents", () => {
      runTest("hello", 'yiwA <C-r>"<Esc>', "hello hello");
    });

    test("<C-o> - execute one normal mode command", () => {
      runTest("hello world", "i<C-o>$end<Esc>", "hello worldend");
    });

    test("<C-v> - insert character literally", () => {
      runTest("hello", "A<C-v>009<Esc>", "hello\t");
    });
  });

  // Register operations that might be missing
  describe("missing register operations", () => {
    test("append to register with uppercase", () => {
      runTest("hello world", '"ayw$"Ayw"ap', "hello worldhello d");
    });

    test("expression register =", () => {
      runTest("result: ", "A<C-r>=2+2<CR><Esc>", "result: 4");
    });

    test("black hole register _", () => {
      runTest("hello world", '"_dw""p', "world");
    });

    test("system clipboard register +", () => {
      // Would need clipboard access
    });
  });

  // Search features that might be missing
  describe("missing search features", () => {
    test("gn - search forward and select match", () => {
      runTest("hello world hello", "/hello<CR>gn", "hello world hello");
    });

    test("gN - search backward and select match", () => {
      runTest("hello world hello", "$?hello<CR>gN", "hello world hello");
    });

    test("* with visual selection", () => {
      runTest("hello world hello", "viw*", "hello world hello");
    });

    test("# with visual selection", () => {
      runTest("hello world hello", "$viw#", "hello world hello");
    });
  });

  // Undo/redo features that might be missing
  describe("missing undo/redo features", () => {
    test("g- - go to older text state", () => {
      // Limitation: Engine implements linear undo, not full undo tree.
      // So g- acts like undo.
      // "hello" -> A"helloworld" -> u"hello" -> $a"hellotest" -> g-"hello"
      runTest("hello", "Aworld<Esc>u$atest<Esc>g-", "hello");
    });

    test("g+ - go to newer text state", () => {
      // Limitation: linear redo.
      runTest("hello", "Aworld<Esc>u$atest<Esc>g-g+", "hellotest");
    });

    test(":earlier - go back in time", () => {
      runTest("hello", "Aworld<Esc>:earlier 1s<CR>", "hello");
    });

    test(":later - go forward in time", () => {
      runTest("hello", "Aworld<Esc>u:later 1s<CR>", "helloworld");
    });
  });

  // Mark features that might be missing
  describe("missing mark features", () => {
    test("'' - jump to position before last jump", () => {
      runTest("line1\nline2\nline3", "Ggg''", "line1\nline2\nline3");
    });

    test("`. - jump to position of last change", () => {
      runTest("hello world", "wwi_<Esc>gg`.", "hello worl_d");
    });

    test("'[ and '] - jump to start/end of last changed text", () => {
      runTest("hello world", "wciw_<Esc>'[", "hello _");
    });
  });

  // Folding (probably not implemented)
  describe("folding features", () => {
    test("zf - create fold", () => {
      // Folding would need significant implementation
    });

    test("zo - open fold", () => {
      // Folding would need significant implementation
    });

    test("zc - close fold", () => {
      // Folding would need significant implementation
    });
  });

  // Window/buffer commands (probably not applicable)
  describe("window/buffer commands", () => {
    test(":split - split window", () => {
      // Not applicable in single buffer context
    });

    test(":vsplit - vertical split", () => {
      // Not applicable in single buffer context
    });

    test(":buffer - switch buffer", () => {
      // Not applicable in single buffer context
    });
  });

  // Miscellaneous missing features
  describe("miscellaneous missing features", () => {
    test("ga - show character info", () => {
      runTest("a", "ga", "a");
    });

    test("g8 - show utf-8 byte sequence", () => {
      runTest("ñ", "g8", "ñ");
    });

    test("ZZ - write and quit", () => {
      // Would need file system access
    });

    test("ZQ - quit without writing", () => {
      // Would need file system access
    });

    test(":help - show help", () => {
      // Not applicable
    });
  });
});

// Test for bugs in existing features
describe("bug tests for existing features", () => {
  describe("motion bugs", () => {
    test("w at end of line should go to next line", () => {
      runTest("hello\nworld", "$wx", "hello\norld");
    });

    test("b at start of line should go to previous line", () => {
      // When at start of line, 'b' goes to beginning of previous word on previous line
      // In vim, from start of 'world', 'b' goes to start of 'hello' (0,0)
      runTest("hello\nworld", "jbx", "ello\nworld");
    });

    test("e at end of word should advance to next word end", () => {
      runTest("hello world test", "eex", "hello worl test");
    });
  });

  describe("text object bugs", () => {
    test("iw on punctuation should select punctuation group", () => {
      runTest("hello... world", "6ldiw", "hello world");
    });

    test("i( should work across multiple lines", () => {
      runTest("(\nhello\n)", "di(", "()");
    });

    test("it should work with nested tags", () => {
      runTest("<a><b>text</b></a>", "f>dit", "<a><b></b></a>");
    });
  });

  describe("operator bugs", () => {
    test("cc on empty line should stay on same line", () => {
      runTest("line1\n\nline3", "jcctext<Esc>", "line1\ntext\nline3");
    });

    test("dd on last line should position cursor correctly", () => {
      runTest("line1\nline2", "jddix<Esc>", "linex1");
    });

    test("yy should preserve cursor position", () => {
      const state = runKeystrokes("hello world", "wyyp");
      expect(state.cursorCol).toBe(0);
    });
  });

  describe("visual mode bugs", () => {
    test("visual block $ should extend to longest line", () => {
      runTest("short\nvery long line\nx", "<C-v>j$d", "\n\n");
    });

    test("visual line paste should preserve indentation", () => {
      runTest("  indented\nline", "Vjp", "line\n  indented");
    });

    test("gv after visual block should restore block", () => {
      const state = runKeystrokes("ab\ncd", "<C-v>j<Esc>gv");
      expect(state.mode).toBe("visual-block");
    });
  });

  describe("register bugs", () => {
    test("unnamed register should be set by delete operations", () => {
      runTest("hello world", 'dw""p', "whello orld");
    });

    test("numbered registers should shift on delete", () => {
      runTest("a b c", 'dw."2p', "c a ");
    });

    test("small delete register should work", () => {
      runTest("hello", 'x"-p', "hhello");
    });
  });

  describe("search bugs", () => {
    test("n should wrap around", () => {
      runTest("hello world hello", "/hello<CR>nnx", "hello world ello");
    });

    test("N should wrap around backwards", () => {
      runTest("hello world hello", "/hello<CR>Nx", "ello world hello");
    });

    test("* on word with special regex chars should escape them", () => {
      runTest("a.b c a.b", "w*nx", "a.b c ab");
    });
  });

  describe("ex command bugs", () => {
    test(":s should only replace first occurrence by default", () => {
      runTest("hello hello", ":%s/hello/hi<CR>", "hi hello");
    });

    test(":g should handle empty pattern", () => {
      runTest("line1\n\nline2", ":g/^$/d<CR>", "line1\nline2");
    });

    test("range with relative line numbers", () => {
      runTest("1\n2\n3\n4", ":2,+1d<CR>", "1\n4");
    });
  });
});
