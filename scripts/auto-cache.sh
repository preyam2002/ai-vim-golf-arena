#!/usr/bin/env zsh
# Fully automated cache generation using Claude CLI + Cursor Agent CLI.
# No API keys needed — uses authenticated CLI sessions.
#
# Usage:
#   ./scripts/auto-cache.sh <model-id> [challenge-number]
#   ./scripts/auto-cache.sh --all [challenge-number]

set -euo pipefail

CURSOR="/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
PROMPTS_DIR="data/cursor-prompts"
RESPONSES_DIR="data/cursor-responses"
INDEX_FILE="$PROMPTS_DIR/index.json"
SOLUTIONS_FILE="data/challenge-solutions.json"

ALL_MODELS=(claude-opus-4-6 claude-sonnet-4-6 gpt-5-4 gpt-5-4-mini codex-5-3 codex-5-2 gemini-3-1-pro grok-4 kimi-k2-5 composer-2)

get_cli_cmd() {
  case "$1" in
    claude-opus-4-6)    echo "claude --print --output-format json --model opus" ;;
    claude-sonnet-4-6)  echo "claude --print --output-format json --model sonnet" ;;
    gpt-5-4)            echo "$CURSOR agent --print --output-format json --model gpt-5.4-high" ;;
    gpt-5-4-mini)       echo "$CURSOR agent --print --output-format json --model gpt-5.4-mini-high" ;;
    codex-5-3)          echo "$CURSOR agent --print --output-format json --model gpt-5.3-codex-high" ;;
    codex-5-2)          echo "$CURSOR agent --print --output-format json --model gpt-5.2-codex-high" ;;
    gemini-3-1-pro)     echo "$CURSOR agent --print --output-format json --model gemini-3.1-pro" ;;
    grok-4)             echo "$CURSOR agent --print --output-format json --model grok-4-20" ;;
    kimi-k2-5)          echo "$CURSOR agent --print --output-format json --model kimi-k2.5" ;;
    composer-2)         echo "$CURSOR agent --print --output-format json --model composer-2" ;;
    *) echo ""; return 1 ;;
  esac
}

# Parse args
MODELS=()
SPECIFIC_NUM=""

if [[ "${1:-}" == "--all" ]]; then
  MODELS=("${ALL_MODELS[@]}")
  SPECIFIC_NUM="${2:-}"
elif [[ -n "${1:-}" ]]; then
  if ! get_cli_cmd "$1" > /dev/null 2>&1; then
    echo "Unknown model: $1"
    echo "Available: ${ALL_MODELS[*]}"
    exit 1
  fi
  MODELS=("$1")
  SPECIFIC_NUM="${2:-}"
else
  echo "Usage: $0 <model-id|--all> [challenge-number]"
  echo "Models: ${ALL_MODELS[*]}"
  exit 1
fi

mkdir -p "$RESPONSES_DIR"

if [[ ! -f "$INDEX_FILE" ]]; then
  echo "Run: npx tsx scripts/generate-cursor-prompts.ts first"
  exit 1
fi

COST_LOG=$(mktemp)
TOTAL_DONE=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

for MODEL_ID in "${MODELS[@]}"; do
  CLI_CMD=$(get_cli_cmd "$MODEL_ID")

  if [[ -n "$SPECIFIC_NUM" ]]; then
    NUMS=("$SPECIFIC_NUM")
  else
    NUMS=($(ls "$PROMPTS_DIR"/*.txt 2>/dev/null | sed 's/.*\///' | grep -oE '^[0-9]+' | sort))
  fi

  echo ""
  echo "========== $MODEL_ID =========="
  echo "CLI: $CLI_CMD"
  echo "Challenges: ${#NUMS[@]}"
  echo ""

  DONE=0
  FAILED=0

  for NUM in "${NUMS[@]}"; do
    NUM=$(printf "%02d" $((10#$NUM)))
    RESPONSE_FILE="$RESPONSES_DIR/${NUM}-${MODEL_ID}.txt"

    if [[ -f "$RESPONSE_FILE" ]] && [[ -s "$RESPONSE_FILE" ]]; then
      echo "[skip] $NUM — response file exists"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    CHALLENGE_ID=$(node -e "const idx=require('./$INDEX_FILE'); console.log(idx['$NUM']?.challengeId||'')")
    if [[ -z "$CHALLENGE_ID" ]]; then
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    ALREADY_CACHED=$(node -e "const s=require('./$SOLUTIONS_FILE'); console.log(s['$CHALLENGE_ID']?.['$MODEL_ID'] ? 'yes' : 'no')")
    if [[ "$ALREADY_CACHED" == "yes" ]]; then
      echo "[skip] $NUM — already cached"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    PROMPT_FILE=$(ls "$PROMPTS_DIR"/${NUM}-*.txt 2>/dev/null | head -1)
    if [[ -z "$PROMPT_FILE" ]]; then
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      continue
    fi

    PROMPT=$(sed -n '/^# ---$/,$ { /^# ---$/d; p; }' "$PROMPT_FILE")
    TITLE=$(node -e "const idx=require('./$INDEX_FILE'); console.log(idx['$NUM']?.title||'?')")
    echo -n "[$NUM] $TITLE ... "

    # Call the CLI with JSON output
    RAW_JSON=$(echo "$PROMPT" | eval $CLI_CMD 2>/dev/null) || {
      echo "FAILED (cli error)"
      FAILED=$((FAILED + 1))
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
      continue
    }

    # Parse JSON to extract result, time, and cost
    # Use printf instead of echo to preserve backslash escapes in JSON
    PARSED=$(printf '%s\n' "$RAW_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    result = data.get('result', data.get('content', data.get('text', '')))
    # Prefer API-measured time over wall clock
    time_ms = data.get('duration_api_ms') or data.get('duration_ms') or 0
    # Cost: Claude CLI uses total_cost_usd, Cursor uses usage
    cost = data.get('total_cost_usd') or 0
    if not cost:
        usage = data.get('usage', {})
        cost = usage.get('cost') or usage.get('total_cost') or 0
    # Also check modelUsage for Claude CLI
    if not cost:
        mu = data.get('modelUsage', {})
        for v in mu.values():
            c = v.get('costUSD', 0)
            if c: cost = c; break
    print(json.dumps({'result': result, 'time_ms': int(time_ms), 'cost': float(cost)}))
except Exception as e:
    print(json.dumps({'result': '', 'time_ms': 0, 'cost': 0, 'error': str(e)}))
" 2>/dev/null)

    RESPONSE=$(printf '%s\n' "$PARSED" | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])" 2>/dev/null)
    TIME_MS=$(printf '%s\n' "$PARSED" | python3 -c "import sys,json; print(json.load(sys.stdin)['time_ms'])" 2>/dev/null)
    COST_USD=$(printf '%s\n' "$PARSED" | python3 -c "import sys,json; c=json.load(sys.stdin)['cost']; print(f'{c:.6f}') if c else print('')" 2>/dev/null)

    if [[ -z "$RESPONSE" ]]; then
      echo "FAILED (empty result)"
      FAILED=$((FAILED + 1))
      TOTAL_FAILED=$((TOTAL_FAILED + 1))
      continue
    fi

    # Save clean response with real API time
    printf "time: %s\n%s" "$TIME_MS" "$RESPONSE" > "$RESPONSE_FILE"

    # Log cost
    COST_TAG=""
    if [[ -n "$COST_USD" && "$COST_USD" != "" ]]; then
      echo "$MODEL_ID,$NUM,$COST_USD" >> "$COST_LOG"
      COST_TAG=" (\$$COST_USD)"
    fi
    echo "${TIME_MS}ms${COST_TAG}"

    DONE=$((DONE + 1))
    TOTAL_DONE=$((TOTAL_DONE + 1))
  done

  echo "--- $MODEL_ID: $DONE done, $FAILED failed ---"
done

echo ""
echo "=============================="
echo "TOTAL: $TOTAL_DONE done, $TOTAL_FAILED failed, $TOTAL_SKIPPED skipped"

if [[ -s "$COST_LOG" ]]; then
  echo ""
  echo "Cost breakdown:"
  while IFS=, read -r model num cost; do
    echo "  $model #$num: \$$cost"
  done < "$COST_LOG"
  TOTAL_COST=$(python3 -c "
costs = []
with open('$COST_LOG') as f:
    for line in f:
        parts = line.strip().split(',')
        if len(parts) >= 3 and parts[2]:
            costs.append(float(parts[2]))
print(f'\${sum(costs):.4f}')")
  echo "  TOTAL: $TOTAL_COST"
fi

rm -f "$COST_LOG"
echo ""
echo "Now run: npx tsx scripts/import-cursor-responses.ts"
