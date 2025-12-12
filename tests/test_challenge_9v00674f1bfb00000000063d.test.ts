/**
 * Vim Parity Tests for Challenge 9v00674f1bfb00000000063d
 * Challenge: YAML to dotenv
 *
 * Transform a YAML config file to extract environment variable names
 * and create a .env file format.
 */
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine";
import { runVimParityAsync } from "../src/lib/vim-parity";

// Challenge data from popular-challenges.json
const startText = `vimgolf:
  logging:
    level: INFO
app:
  postgres:
    host: !ENV {POSTGRES_HOST}
    port: !ENV {POSTGRES_PORT}
  pulsar:
    host: !ENV \${PULSAR_HOST}
    port: !ENV \${PULSAR_PORT}
    namespace: vimgolf
    topic: !ENV \${PULSAR_TOPIC}
`;

const targetText = `POSTGRES_HOST=
POSTGRES_PORT=
PULSAR_HOST=
PULSAR_PORT=
PULSAR_TOPIC=
`;

// Enable real Vim parity checking
process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

// Solutions using different vim approaches
const solutions = [
  {
    name: "search-and-extract",
    description: "Use search to find ENV vars and extract them",
    keystrokes:
      ":v/!ENV/d<CR>:%s/.*{\\(.*\\)}/\\1=/<CR>:%s/.*" +
      "$" +
      "{\\(.*\\)}/\\1=/<CR>",
  },
  {
    name: "global-command",
    description: "Use :g command to delete non-matching lines",
    keystrokes: ":g/!ENV/!d<CR>:%s/.*[{" + "$" + "]\\(\\w\\+\\)}.*/\\1=/<CR>",
  },
  {
    name: "substitute-chain",
    description: "Chain substitutions to extract vars",
    keystrokes:
      ":v/ENV/d<CR>:%s/.*{\\(\\w\\+\\)}/\\1=/<CR>:%s/.*" +
      "$" +
      "{\\(\\w\\+\\)}/\\1=/<CR>",
  },
];

// Helper function to replay keystrokes
function replayInEngine(text: string, keystrokes: string): string {
  let state = createInitialState(text);
  let remaining = keystrokes;
  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode);
    if (!stroke) break;
    state = executeKeystroke(state, stroke);
    remaining = remaining.slice(stroke.length);
  }
  return state.lines.join("\n");
}

describe("Challenge 9v00674f1bfb00000000063d - YAML to dotenv parity", () => {
  solutions.forEach(({ name, keystrokes }) => {
    it(`${name} - engine matches nvim output`, async () => {
      const parityResult = await runVimParityAsync({
        startText,
        keystrokes,
        vimBin: "nvim",
        timeoutMs: 5000,
      });

      if (parityResult.engineNormalized !== parityResult.vimNormalized) {
        console.log(`\n=== Mismatch for ${name} ===`);
        console.log(
          "Engine:",
          JSON.stringify(parityResult.engineNormalized.slice(0, 200))
        );
        console.log(
          "Vim:   ",
          JSON.stringify(parityResult.vimNormalized.slice(0, 200))
        );
      }
      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });
});

describe("Challenge 9v00674f1bfb00000000063d - specific command parity", () => {
  const commandTests = [
    {
      name: ":v/pattern/d - delete lines NOT matching pattern",
      keystrokes: ":v/!ENV/d<CR>",
    },
    {
      name: ":g/pattern/!d - delete lines NOT matching (alternate syntax)",
      keystrokes: ":g/!ENV/!d<CR>",
    },
    {
      name: "substitute with word boundary \\w+",
      keystrokes: String.raw`:%s/{\(\w\+\)}/[\1]/<CR>`,
    },
    {
      name: "substitute with $ prefix",
      keystrokes: ":%s/\\" + "$" + "{\\(\\w\\+\\)}/" + "$" + "[\\1]/<CR>",
    },
  ];

  commandTests.forEach(({ name, keystrokes }) => {
    it(`${name} - matches nvim`, async () => {
      const parityResult = await runVimParityAsync({
        startText,
        keystrokes,
        vimBin: "nvim",
        timeoutMs: 3000,
      });

      if (parityResult.engineNormalized !== parityResult.vimNormalized) {
        console.log(`\n=== Command mismatch: ${name} ===`);
        console.log(
          "Engine:",
          JSON.stringify(parityResult.engineNormalized.slice(0, 300))
        );
        console.log(
          "Vim:   ",
          JSON.stringify(parityResult.vimNormalized.slice(0, 300))
        );
      }
      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });
});

describe("Challenge 9v00674f1bfb00000000063d - isolated tests", () => {
  it("basic :v command - delete non-matching lines", async () => {
    const simpleText = `keep this
delete this
keep this too
delete also
`;
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: ":v/keep/d<CR>",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it(":g/pattern/!d - alternate delete non-matching", async () => {
    const simpleText = `keep this
delete this
keep this too
delete also
`;
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: ":g/keep/!d<CR>",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});
