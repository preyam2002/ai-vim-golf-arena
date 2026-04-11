#!/usr/bin/env zsh
# Cache solutions for static challenges (static-1 through static-10)
#
# Usage:
#   ./scripts/cache-static-challenges.sh <model-id>
#   ./scripts/cache-static-challenges.sh --all

set -euo pipefail

CURSOR="/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
RESPONSES_DIR="data/cursor-responses"
SOLUTIONS_FILE="data/challenge-solutions.json"

ALL_MODELS=(claude-opus-4-6 claude-sonnet-4-6 gpt-5-4 codex-5-3 codex-5-2 gemini-3-1-pro grok-4 kimi-k2-5 composer-2)

get_cli_cmd() {
  case "$1" in
    claude-opus-4-6)    echo "claude --print --output-format json --model opus" ;;
    claude-sonnet-4-6)  echo "claude --print --output-format json --model sonnet" ;;
    gpt-5-4)            echo "$CURSOR agent --print --output-format json --model gpt-5.4-high" ;;
    codex-5-3)          echo "$CURSOR agent --print --output-format json --model gpt-5.3-codex-high" ;;
    codex-5-2)          echo "$CURSOR agent --print --output-format json --model gpt-5.2-codex-high" ;;
    gemini-3-1-pro)     echo "$CURSOR agent --print --output-format json --model gemini-3.1-pro" ;;
    grok-4)             echo "$CURSOR agent --print --output-format json --model grok-4-20" ;;
    kimi-k2-5)          echo "$CURSOR agent --print --output-format json --model kimi-k2.5" ;;
    composer-2)         echo "$CURSOR agent --print --output-format json --model composer-2" ;;
    *) echo ""; return 1 ;;
  esac
}

PROMPT_TEMPLATE='You are an expert Vim golfer. Transform START into TARGET with the ABSOLUTE MINIMUM Vim keystrokes.

## REASONING (Think Step-by-Step)
1. Analyze: What changes are needed between START and TARGET?
2. Options: List 2-3 approaches (substitution, macros, ranges, etc.)
3. Count: Estimate keystrokes for each approach
4. Choose: Pick the approach with FEWEST keystrokes
5. Verify: Confirm your solution produces exact TARGET

## OUTPUT RULES (Strict)
- Output ONLY raw Vim keystrokes - NO markdown, NO explanation, NO code blocks
- Use notation: <Esc>, <CR>, <BS> for special keys
- Cursor starts at 0,0 in Normal mode
- First character must be a valid Vim keystroke

## EFFICIENCY PATTERNS
- :%s/old/new/g<CR> beats repeated cwfoo<Esc>
- :3,6d<CR> beats dddddd
- . (dot repeat) for repetitive edits
- Macros (q<reg>..q @<reg>) for complex repeats
- :g/pattern/d<CR> for multi-line deletes

Return ONLY the Vim keystrokes to transform START into TARGET.
Do not include markdown, quotes, explanations, or extra lines.

START TEXT:
```
%START%
```

TARGET TEXT:
```
%TARGET%
```'

# Static challenge data: "id|title|start|target"
typeset -A CHALLENGE_START
typeset -A CHALLENGE_TARGET
typeset -A CHALLENGE_TITLE

CHALLENGE_TITLE[static-1]="Simple Addition"
CHALLENGE_START[static-1]="apple
banana
cherry"
CHALLENGE_TARGET[static-1]="1. apple
2. banana
3. cherry"

CHALLENGE_TITLE[static-2]="Swap Words"
CHALLENGE_START[static-2]="hello world
foo bar
ping pong"
CHALLENGE_TARGET[static-2]="world hello
bar foo
pong ping"

CHALLENGE_TITLE[static-3]="Remove Duplicates"
CHALLENGE_START[static-3]="one
two
two
three
three
three"
CHALLENGE_TARGET[static-3]="one
two
three"

CHALLENGE_TITLE[static-4]="Uppercase Conversion"
CHALLENGE_START[static-4]="hello world
this is vim golf"
CHALLENGE_TARGET[static-4]="HELLO WORLD
THIS IS VIM GOLF"

CHALLENGE_TITLE[static-5]="Add Quotes"
CHALLENGE_START[static-5]="apple banana cherry"
CHALLENGE_TARGET[static-5]='"apple" "banana" "cherry"'

CHALLENGE_TITLE[static-6]="Reverse Lines"
CHALLENGE_START[static-6]="first
second
third
fourth"
CHALLENGE_TARGET[static-6]="fourth
third
second
first"

CHALLENGE_TITLE[static-7]="Delete Empty Lines"
CHALLENGE_START[static-7]="line1

line2


line3"
CHALLENGE_TARGET[static-7]="line1
line2
line3"

CHALLENGE_TITLE[static-8]="Add Semicolons"
CHALLENGE_START[static-8]="let x = 1
let y = 2
let z = 3"
CHALLENGE_TARGET[static-8]="let x = 1;
let y = 2;
let z = 3;"

CHALLENGE_TITLE[static-9]="Trim Spaces"
CHALLENGE_START[static-9]=$'alpha  \nbeta   \ngamma    \ndelta'
CHALLENGE_TARGET[static-9]=$'alpha\nbeta\ngamma\ndelta'

CHALLENGE_TITLE[static-10]="Join Lines"
CHALLENGE_START[static-10]="red
green
blue
yellow"
CHALLENGE_TARGET[static-10]="red, green, blue, yellow"

STATIC_IDS=(static-1 static-2 static-3 static-4 static-5 static-6 static-7 static-8 static-9 static-10)

MODELS=()
if [[ "${1:-}" == "--all" ]]; then
  MODELS=("${ALL_MODELS[@]}")
elif [[ -n "${1:-}" ]]; then
  if ! get_cli_cmd "$1" > /dev/null 2>&1; then
    echo "Unknown model: $1"
    echo "Available: ${ALL_MODELS[*]}"
    exit 1
  fi
  MODELS=("$1")
else
  echo "Usage: $0 <model-id|--all>"
  echo "Models: ${ALL_MODELS[*]}"
  exit 1
fi

mkdir -p "$RESPONSES_DIR"

TOTAL_DONE=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

for MODEL_ID in "${MODELS[@]}"; do
  CLI_CMD=$(get_cli_cmd "$MODEL_ID")
  echo ""
  echo "========== $MODEL_ID =========="
  DONE=0
  FAILED=0

  for CHALLENGE_ID in "${STATIC_IDS[@]}"; do
    RESPONSE_FILE="$RESPONSES_DIR/${CHALLENGE_ID}-${MODEL_ID}.txt"

    if [[ -f "$RESPONSE_FILE" ]] && [[ -s "$RESPONSE_FILE" ]]; then
      echo "[skip] $CHALLENGE_ID — response file exists"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    ALREADY_CACHED=$(node -e "const s=require('./$SOLUTIONS_FILE'); console.log(s['$CHALLENGE_ID']?.['$MODEL_ID'] ? 'yes' : 'no')" 2>/dev/null || echo "no")
    if [[ "$ALREADY_CACHED" == "yes" ]]; then
      echo "[skip] $CHALLENGE_ID — already in solutions.json"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    START="${CHALLENGE_START[$CHALLENGE_ID]}"
    TARGET="${CHALLENGE_TARGET[$CHALLENGE_ID]}"
    TITLE="${CHALLENGE_TITLE[$CHALLENGE_ID]}"

    PROMPT="You are an expert Vim golfer. Transform START into TARGET with the ABSOLUTE MINIMUM Vim keystrokes.

## REASONING (Think Step-by-Step)
1. Analyze: What changes are needed between START and TARGET?
2. Options: List 2-3 approaches (substitution, macros, ranges, etc.)
3. Count: Estimate keystrokes for each approach
4. Choose: Pick the approach with FEWEST keystrokes
5. Verify: Confirm your solution produces exact TARGET

## OUTPUT RULES (Strict)
- Output ONLY raw Vim keystrokes - NO markdown, NO explanation, NO code blocks
- Use notation: <Esc>, <CR>, <BS> for special keys
- Cursor starts at 0,0 in Normal mode
- First character must be a valid Vim keystroke

## EFFICIENCY PATTERNS
- :%s/old/new/g<CR> beats repeated cwfoo<Esc>
- :3,6d<CR> beats dddddd
- . (dot repeat) for repetitive edits
- Macros (q<reg>..q @<reg>) for complex repeats
- :g/pattern/d<CR> for multi-line deletes

Return ONLY the Vim keystrokes to transform START into TARGET.
Do not include markdown, quotes, explanations, or extra lines.

START TEXT:
\`\`\`
${START}
\`\`\`

TARGET TEXT:
\`\`\`
${TARGET}
\`\`\`"

    echo -n "[$CHALLENGE_ID] $TITLE ... "
    START_TIME=$(($(date +%s%N)/1000000))

    RAW_JSON=$(echo "$PROMPT" | eval $CLI_CMD 2>/dev/null) || {
      echo "FAILED (CLI error)"
      FAILED=$((FAILED + 1))
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
      continue
    }

    END_TIME=$(($(date +%s%N)/1000000))
    ELAPSED=$((END_TIME - START_TIME))

    KEYSTROKES=$(echo "$RAW_JSON" | node -e "
      const chunks = [];
      process.stdin.on('data', c => chunks.push(c));
      process.stdin.on('end', () => {
        try {
          const r = JSON.parse(chunks.join(''));
          const text = r.result || r.content || r.text || '';
          console.log(text.trim());
        } catch(e) {
          process.stdout.write(chunks.join('').trim());
        }
      });
    " 2>/dev/null)

    if [[ -z "$KEYSTROKES" ]]; then
      echo "FAILED (empty response)"
      FAILED=$((FAILED + 1))
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
      continue
    fi

    echo "time: $ELAPSED" > "$RESPONSE_FILE"
    echo "$KEYSTROKES" >> "$RESPONSE_FILE"

    echo "${ELAPSED}ms"
    DONE=$((DONE + 1))
    TOTAL_DONE=$((TOTAL_DONE + 1))
  done

  echo "--- $MODEL_ID: $DONE done, $FAILED failed ---"
done

echo ""
echo "=============================="
echo "TOTAL: $TOTAL_DONE done, $TOTAL_FAILED failed, $TOTAL_SKIPPED skipped"
echo ""
echo "Now run: npx tsx scripts/import-cursor-responses.ts"
