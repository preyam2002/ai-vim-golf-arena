function tokenizeKeystrokes(keystrokes: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < keystrokes.length) {
    if (keystrokes[i] === "<") {
      const end = keystrokes.indexOf(">", i);
      if (end !== -1) {
        tokens.push(keystrokes.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    if (
      keystrokes[i] === ":" ||
      keystrokes[i] === "/" ||
      keystrokes[i] === "?"
    ) {
      const crIdx = keystrokes.indexOf("<CR>", i);
      if (crIdx !== -1) {
        tokens.push(keystrokes.slice(i, crIdx + 4));
        i = crIdx + 4;
        continue;
      }
    }

    tokens.push(keystrokes[i]);
    i++;
  }

  return tokens;
}

function flattenTokens(tokens: string[]): string[] {
  const flat: string[] = [];
  for (const token of tokens) {
    if (token.length > 1 && !token.startsWith("<")) {
      let i = 0;
      while (i < token.length) {
        if (token[i] === "<") {
          const end = token.indexOf(">", i);
          if (end !== -1) {
            flat.push(token.slice(i, end + 1));
            i = end + 1;
            continue;
          }
        }
        flat.push(token[i]);
        i++;
      }
    } else {
      flat.push(token);
    }
  }
  return flat;
}

const input = ":%s/^/\\=line('.').'. '/<CR>";
const tokens = tokenizeKeystrokes(input);
console.log("Tokens:", tokens);

const flat = flattenTokens(tokens);
console.log("Flat:", flat);

// Verify expected output
// Should be [':', '%', 's', ..., '<CR>']
const expectedLength = input.length - 3; // <CR> is 4 chars, counts as 1 token. So length is len - 4 + 1 = len - 3.
// Wait, <CR> is 4 chars. In flattened, it's 1 token.
// Original string length: ... + 4 (<CR>)
// Flattened array length: ... + 1 (<CR>)
// So flattened length should be original length - 3.

console.log("Original length:", input.length);
console.log("Flat length:", flat.length);

if (flat.length === input.length - 3) {
  console.log("SUCCESS: Flattened length matches expected.");
} else {
  console.log("FAILURE: Flattened length mismatch.");
}

// Check last token
if (flat[flat.length - 1] === "<CR>") {
  console.log("SUCCESS: Last token is <CR>");
} else {
  console.log("FAILURE: Last token is", flat[flat.length - 1]);
}
