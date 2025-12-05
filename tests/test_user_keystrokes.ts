import { createInitialState, executeKeystroke } from "../src/lib/vim-engine";

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

// User's keystroke sequence
const input = `:%g/^<<<<<<</d<CR>:%g/^=======/d<CR>:%g/^>>>>>>>/d<CR>3Gdd4GA<CR>    total = total * 0.9  # Apply 10% discount<Esc>10Gdd17Gdd18GA<CR>        'items_count': len(items),<Esc>`;

console.log("Testing keystroke sequence...\n");
console.log("Keystrokes:", input);
console.log(
  "\n================================================================================\n"
);

// Custom tokenizer that properly handles Ex commands and search
// IMPORTANT: Must find Ex commands FIRST before looking for special keys
const tokens: string[] = [];
let i = 0;

while (i < input.length) {
  // Check for Ex command first (: followed by <CR>)
  if (input[i] === ":") {
    const end = input.indexOf("<CR>", i);
    if (end !== -1) {
      tokens.push(input.slice(i, end + 4));
      i = end + 4;
      continue;
    }
  }

  // Check for Search command (/ followed by <CR>)
  if (input[i] === "/") {
    const end = input.indexOf("<CR>", i);
    if (end !== -1) {
      tokens.push(input.slice(i, end + 4));
      i = end + 4;
      continue;
    }
  }

  // Check for special keys like <Esc>, <CR>, <C-a> etc.
  // Only match if followed by known special key patterns
  if (input[i] === "<") {
    const end = input.indexOf(">", i);
    if (end !== -1) {
      const potentialKey = input.slice(i, end + 1);
      // Check if it's a known special key
      if (/^<(Esc|CR|C-[a-z]|BS|Tab|Enter|Space|Bar)>$/i.test(potentialKey)) {
        tokens.push(potentialKey);
        i = end + 1;
        continue;
      }
    }
  }

  // Skip newlines
  if (input[i] === "\n") {
    i++;
    continue;
  }

  // Regular character
  tokens.push(input[i]);
  i++;
}

console.log(`Tokens (${tokens.length}):`, tokens.slice(0, 15), "...\n");

let state = createInitialState(startText);

for (let j = 0; j < tokens.length; j++) {
  const token = tokens[j];

  console.log(
    `[${j + 1}/${tokens.length}] Executing: ${token.replace(/\n/g, "\\n")}`
  );
  console.log(
    `  Before - Lines: ${state.lines.length}, Cursor: ${state.cursorLine}:${state.cursorCol}, Mode: ${state.mode}`
  );

  state = executeKeystroke(state, token);

  console.log(
    `  After  - Lines: ${state.lines.length}, Cursor: ${state.cursorLine}:${state.cursorCol}, Mode: ${state.mode}\n`
  );
}

console.log(
  "\n================================================================================\n"
);
console.log("FINAL TEXT:\n");
console.log(state.lines.join("\n"));

console.log(
  "\n\n================================================================================\n"
);
const finalText = state.lines.join("\n") + "\n";
if (finalText === targetText) {
  console.log("RESULT: ✅ SUCCESS - Text matches target!");
} else {
  console.log("RESULT: ❌ FAILED - Text does not match target");
  console.log(
    `\nFinal length: ${finalText.length}, Target length: ${targetText.length}`
  );
}
