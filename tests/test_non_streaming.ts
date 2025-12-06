// Quick test to call LLM without streaming
import { availableModels, callAIGateway } from "../src/lib/ai-gateway";

const SYSTEM_PROMPT = `You are an expert Vim golfer competing for the MINIMUM keystroke count. Every keystroke matters.

CRITICAL RULES:
1. Output ONLY raw Vim keystrokes - NO markdown, NO code blocks, NO quotes, NO explanations
2. Use standard Vim notation: <Esc>, <CR>, <BS> for special keys
3. BE EXTREMELY EFFICIENT - use regex substitutions, global commands, and macros
4. NEVER generate repetitive sequences like jddjddjdd... - use ranges and commands instead
5. Maximum ~100 keystrokes for most challenges - think before you type
6. Cursor starts at 0,0 in Normal mode

EFFICIENCY EXAMPLES:
BAD (manual edits):  jddjddjddjdd... (50+ keystrokes)
GOOD (one command):  :3,6d<CR> (8 keystrokes)

BAD (manual):        cwfoo<Esc>jcwfoo<Esc>jcwfoo<Esc>
GOOD (substitute):   :%s/old/foo/g<CR>

BAD (line by line):  dddddddddd (delete 10 lines manually)
GOOD (range):        :1,10d<CR> or 10dd

For merge conflicts, use global commands:
:%g/^<<<<<<</d<CR>      Delete conflict markers
:%g/^=======/d<CR>      Delete separators  
:%g/^>>>>>>>/d<CR>      Delete end markers

Think: "What's the SHORTEST vim command sequence to achieve this?"

Valid output format (plain text, no wrapping):
:%s/old/new/g<CR>
ggdG
3dd`;

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

async function testNonStreaming() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error("Missing AI_GATEWAY_API_KEY");
    process.exit(1);
  }

  const modelId = availableModels[0]?.id ?? "openai/gpt-4o-mini";

  console.log("Making non-streaming API call...\n");

  const content = await callAIGateway(modelId, startText, targetText, apiKey);

  console.log("RAW LLM OUTPUT:");
  console.log("=".repeat(80));
  console.log(content);
  console.log("=".repeat(80));
  console.log(`\nLength: ${content?.length || 0} characters`);
  console.log(`\nHas markdown wrapper: ${content?.includes("```")}`);
  console.log(`First 200 chars: ${content?.slice(0, 200)}`);
}

testNonStreaming().catch(console.error);
