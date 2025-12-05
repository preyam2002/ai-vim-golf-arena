// Test if our vim engine can handle the LLM's output
import {
  createInitialState,
  executeKeystroke,
  normalizeText,
} from "../src/lib/vim-engine";

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
    return f"$\{amount:.2f}"
=======
    """Format amount as EUR"""
    return f"€\{amount:.2f}"
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
>>>>>>> feature/shipping`;

const targetText = `def calculate_total(items):
    """Calculate total price of items with tax"""
    total = sum(item['price'] for item in items)
    total = total * 0.9  # Apply 10% discount
    return total * 1.15  # Apply 15% tax

def format_currency(amount):
    """Format amount as EUR"""
    return f"€\{amount:.2f}"

def process_order(items):
    total = calculate_total(items)
    shipping = 5.99 if total < 50 else 0
    return {
        'status': 'processed',
        'total': format_currency(total + shipping),
        'items_count': len(items),
        'shipping': shipping
    }`;

// Test the LLM's output
const llmKeystrokes = `:%g/^<<<<<<<\\|^=======\\|^>>>>>>>/d<CR>
gg
dd
dd
dd
dd
/return total \\* 1.15<CR>
O    total = total * 0.9  # Apply 10% discount<Esc>
:%s/USD/EUR/g<CR>
gg
/def format_currency<CR>
j
dd
dd
gg
/def process_order<CR>
jj
dd
dd
dd
dd
dd
/shipping = 5.99<CR>
jjjo        'items_count': len(items),<Esc>`;

console.log("Testing LLM keystrokes...\n");
console.log("Keystrokes:", llmKeystrokes);
console.log("\n" + "=".repeat(80));

let state = createInitialState(startText);

// Tokenize and execute
const tokens = [];
let i = 0;
const input = llmKeystrokes;

// Simple tokenizer for this test
while (i < input.length) {
  if (input[i] === "<") {
    const end = input.indexOf(">", i);
    if (end !== -1) {
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
      continue;
    }
  }
  if (input[i] === ":") {
    // Ex command
    const end = input.indexOf("<CR>", i);
    if (end !== -1) {
      tokens.push(input.slice(i, end + 4));
      i = end + 4;
      continue;
    }
  }
  if (input[i] === "/") {
    // Search
    const end = input.indexOf("<CR>", i);
    if (end !== -1) {
      tokens.push(input.slice(i, end + 4));
      i = end + 4;
      continue;
    }
  }
  if (input[i] === "\n") {
    i++;
    continue;
  }
  tokens.push(input[i]);
  i++;
}

console.log(`\nTokens (${tokens.length}):`, tokens.slice(0, 10), "...");

try {
  for (let j = 0; j < tokens.length; j++) {
    const token = tokens[j];
    console.log(`\n[${j + 1}/${tokens.length}] Executing: ${token}`);
    state = executeKeystroke(state, token);

    if (j < 5 || j === tokens.length - 1) {
      console.log(
        `  Lines: ${state.lines.length}, Cursor: ${state.cursorLine}:${state.cursorCol}, Mode: ${state.mode}`
      );
    }
  }

  const finalText = state.lines.join("\n");
  const normalizedFinal = normalizeText(finalText);
  const normalizedTarget = normalizeText(targetText);
  const success = normalizedFinal === normalizedTarget;

  console.log("\n" + "=".repeat(80));
  console.log("RESULT:", success ? "✅ SUCCESS" : "❌ FAILED");
  console.log("=".repeat(80));

  if (!success) {
    console.log("\nFinal text length:", finalText.length);
    console.log("Target text length:", targetText.length);
    console.log("\nFirst 500 chars of final:");
    console.log(finalText.slice(0, 500));
    console.log("\nFirst 500 chars of target:");
    console.log(targetText.slice(0, 500));
  } else {
    console.log("\n✅ All commands executed successfully!");
    console.log("Final text matches target!");
  }
} catch (error) {
  console.error("\n❌ ERROR:", error);
  console.error("\nState at error:");
  console.error("  Lines:", state.lines.slice(0, 5));
  console.error("  Mode:", state.mode);
  console.error("  Cursor:", state.cursorLine, state.cursorCol);
}
