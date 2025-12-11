import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine";
import { runVimParity } from "../src/lib/vim-parity";

// Mock VimState interface
interface VimState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  mode: string;
  commandLine: string | null;
  [key: string]: any;
}

const startText = `<<<<<<< HEAD
def calculate_total(items):
    """Calculate total price of items with 10% discount"""
    total = sum(item['price'] for item in items)
    return total * 0.9  # Apply 10% discount
=======
def calculate_total(items):
    """Calculate total price of items with tax"""
    total = sum(item['price'] for item in items)
    return total * 1.15  # Apply 15% tax
>>>>>>> feature/add-tax

def format_currency(amount):
<<<<<<< HEAD
    """Format amount as USD"""
    return f"\${amount:.2f}"
=======
    """Format amount as EUR"""
    return f"€{amount:.2f}"
>>>>>>> feature/currency-update

def process_order(items):
    total = calculate_total(items)
<<<<<<< HEAD
    return {
        'status': 'success',
        'total': format_currency(total),
        'items_count': len(items)
    }
=======
    shipping = 5.99 if total < 50 else 0
    return {
        'status': 'processed',
        'total': format_currency(total + shipping),
        'shipping': shipping
    }
>>>>>>> feature/shipping
`;

const targetText = `def calculate_total(items):
    """Calculate total price of items with tax"""
    total = sum(item['price'] for item in items)
    total = total * 0.9  # Apply 10% discount
    return total * 1.15  # Apply 15% tax

def format_currency(amount):
    """Format amount as EUR"""
    return f"€{amount:.2f}"

def process_order(items):
    total = calculate_total(items)
    shipping = 5.99 if total < 50 else 0
    return {
        'status': 'processed',
        'total': format_currency(total + shipping),
        'items_count': len(items),
        'shipping': shipping
    }
`;

const sequence = [
  ":%g/^<<<<<<</d<CR>",
  ":%g/^=======/d<CR>",
  ":%g/^>>>>>>>/d<CR>",
  "1GdG",
  'idef calculate_total(items):<CR>"""Calculate total price of items with tax"""<CR>total = sum(item[\'price\'] for item in items)<CR>total = total * 0.9  # Apply 10% discount<CR>return total * 1.15  # Apply 15% tax<CR><CR>def format_currency(amount):<CR>"""Format amount as EUR"""<CR>return f"€{amount:.2f}"<CR><CR>def process_order(items):<CR>total = calculate_total(items)<CR>shipping = 5.99 if total < 50 else 0<CR>return {<CR>    \'status\': \'processed\',<CR>    \'total\': format_currency(total + shipping),<CR>    \'items_count\': len(items),<CR>    \'shipping\': shipping<CR><BS><BS><BS><BS>}<CR><Esc>',
];

function runTest() {
  console.log("=== Running Test for Challenge 9v00672c1db90000000005ba ===");

  let vimState = createInitialState(startText);
  let rawInput = "";
  let processedIndex = 0;
  const capturedTokens: string[] = [];

  // Combine sequence into one input stream for simulation
  // We need to be careful about how we feed this.
  // The engine expects keys.
  // We can just iterate through the sequence array and feed each string.
  // But extractKeystroke expects a stream.

  const fullInput = sequence.join("");
  console.log("Full Input Sequence:", fullInput);

  let remainingInput = fullInput;

  while (remainingInput.length > 0) {
    const keystroke = extractKeystroke(remainingInput, vimState.mode);

    if (!keystroke) {
      console.log(
        `[Wait] extractKeystroke returned null for "${remainingInput}"`
      );
      break;
    }

    // console.log(`[Exec] "${keystroke}"`);

    try {
      vimState = executeKeystroke(vimState, keystroke);
      capturedTokens.push(keystroke);
    } catch (e) {
      console.error("[Error] executeKeystroke failed:", e);
      break;
    }

    remainingInput = remainingInput.slice(keystroke.length);
  }

  const finalText = vimState.lines.join("\n");

  console.log("\n=== Final Result ===");
  if (finalText === targetText.trim()) {
    // trim to handle potential trailing newline differences
    console.log("✅ Test PASSED");
  } else {
    console.log("❌ Test FAILED");
    console.log("\nExpected:\n" + targetText);
    console.log("\nActual:\n" + finalText);

    // Simple diff
    const expectedLines = targetText.split("\n");
    const actualLines = vimState.lines;
    console.log("\nDiff:");
    for (
      let i = 0;
      i < Math.max(expectedLines.length, actualLines.length);
      i++
    ) {
      if (expectedLines[i] !== actualLines[i]) {
        console.log(`Line ${i + 1}:`);
        console.log(`  Exp: ${expectedLines[i] || "<EOF>"}`);
        console.log(`  Act: ${actualLines[i] || "<EOF>"}`);
      }
    }
  }

  // Parity Check (re-using full input)
  console.log("\n=== Checking Parity ===");
  // We need tokens. extractKeystroke does that iteratively.
  // Ideally, use tokenizeKeystrokes if available, or just runVimParity with keystrokes string if supported?
  // runVimParity supports 'keystrokes' string and uses 'tokenizeKeystrokes'.
  // But extractKeystroke handling of 'sequence' array joined might differ?
  // The script joins sequence.

  const parityRes = runVimParity({
    startText: startText,
    tokens: capturedTokens,
    vimBin: "nvim",
  });

  if (parityRes.engineNormalized === parityRes.vimNormalized) {
    console.log("✅ PARITY MATCH");
  } else {
    console.log("❌ PARITY MISMATCH");
    console.log("Vim:", parityRes.vimNormalized);
    console.log("Engine:", parityRes.engineNormalized);
  }
}

runTest();
