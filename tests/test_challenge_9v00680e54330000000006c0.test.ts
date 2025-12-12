/**
 * Vim Parity Tests for Challenge 9v00680e54330000000006c0
 * Challenge: Create json from a .env file
 *
 * These tests verify that our vim engine produces the same output as real nvim
 * for various solutions to this challenge.
 *
 * KNOWN ISSUES DISCOVERED:
 * 1. user/sequence-1: Uses `gg}dk` - the `}` motion followed by `dk` has parity issues.
 *    The engine appears to process the `}` motion differently than nvim when combined
 *    with subsequent motions in a complex sequence.
 *
 * 2. baseline-2 (macros): Macro recording/replay (`q` and `@q`) has issues with
 *    complex sequences. The engine seems to lose characters during macro replay.
 *
 * 3. gg}dk motion test: The `}` paragraph motion combined with `dk` (delete line up)
 *    produces different results in our engine vs nvim.
 */
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
} from "../src/lib/vim-engine";
import { runVimParityAsync } from "../src/lib/vim-parity";

// Challenge data from popular-challenges.json
const startText = `# API Settings
JOBS_API_URL=http://localhost:5000
JOBS_BASE_URL=http://localhost:8000
SCRAPERS_BASE_URL=http://localhost:9900

# Database Settings
JOBS_DATABASE_URI=mongodb://mongouser:mongopassword@127.0.0.1:27017/app

# Redis Settings
JOBS_REDIS_DSN=redis://127.0.0.1:6000

# Data API
DATA_BASE_URL=http://127.0.0.1:8900

# Minio config
JOBS_MINIO_SECURE=false
JOBS_MINIO_ACCESS_KEY=miniouser
JOBS_MINIO_SECRET_KEY=miniosecret
JOBS_MINIO_HOST=127.0.0.1:9500
JOBS_MINIO_DEFAULT_BUCKET=jobs
JOBS_MINIO_REGION=us-west-1
JOBS_MINIO_CREATE_BUCKETS=false
JOBS_MINIO_RESULTS_FORMAT=results/{job.id}.json
JOBS_MINIO_ARGUMENTS_FORMAT=arguments/{job.id}.json
JOBS_MINIO_SERVICES_PATH=services/{job.service.bucket_name}
JOBS_MINIO_LOGS_BUCKET=

# RabbitMQ Settings
JOBS_RABBITMQ_URI=amqp://rabbitmquser:rabbitmqpassword@127.0.0.1:5672

# Package registry
REGISTRY_TOKEN=g_dka000111222333444

LOG_FORMAT=text

# Slack notifications
SLACK_TOKEN=
LOGGING_CHANNEL=

# Metadata API
TEST_METADATA_BASE_URL=http://127.0.0.1:8801
`;

const targetText = `{
    "JOBS_API_URL": "http://localhost:5000",
    "JOBS_BASE_URL": "http://localhost:8000",
    "SCRAPERS_BASE_URL": "http://localhost:9900",
    "JOBS_DATABASE_URI": "mongodb://mongouser:mongopassword@127.0.0.1:27017/app",
    "JOBS_REDIS_DSN": "redis://127.0.0.1:6000",
    "DATA_BASE_URL": "http://127.0.0.1:8900",
    "JOBS_MINIO_SECURE": "false",
    "JOBS_MINIO_ACCESS_KEY": "miniouser",
    "JOBS_MINIO_SECRET_KEY": "miniosecret",
    "JOBS_MINIO_HOST": "127.0.0.1:9500",
    "JOBS_MINIO_DEFAULT_BUCKET": "jobs",
    "JOBS_MINIO_REGION": "us-west-1",
    "JOBS_MINIO_CREATE_BUCKETS": "false",
    "JOBS_MINIO_RESULTS_FORMAT": "results/{job.id}.json",
    "JOBS_MINIO_ARGUMENTS_FORMAT": "arguments/{job.id}.json",
    "JOBS_MINIO_SERVICES_PATH": "services/{job.service.bucket_name}",
    "JOBS_MINIO_LOGS_BUCKET": "",
    "JOBS_RABBITMQ_URI": "amqp://rabbitmquser:rabbitmqpassword@127.0.0.1:5672",
    "REGISTRY_TOKEN": "g_dka000111222333444",
    "LOG_FORMAT": "text",
    "SLACK_TOKEN": "",
    "LOGGING_CHANNEL": "",
    "TEST_METADATA_BASE_URL": "http://127.0.0.1:8801"
}
`;

// Solutions from challenge-solutions.json
const solutions = [
  {
    name: "user/sequence-1",
    keystrokes: String.raw`:%s/^# .*\n//g<CR>:%s/^\([^=]*\)=\(.*\)$/ "\1": "\2",/g<CR>gg}dkO{<Esc>Go}<Esc>:g/^$/d<CR>`,
  },
  {
    name: "user/sequence-2",
    keystrokes: String.raw`:g/^#/d<CR>:%s/^\([^=]*\)=\(.*\)$/"\1": "\2",/<CR>:$s/,$/<CR>ggO{<Esc>Go}<Esc>`,
  },
  {
    name: "user/sequence-3",
    keystrokes: String.raw`:g/^#/d<CR>ggO{<Esc>:%s/\([^=]*\)=\(.*\)/ "\1": "\2",/<CR>G$h xGo}<Esc>`,
  },
];

// Additional solutions that use different vim features
const additionalSolutions = [
  {
    name: "baseline-1 (g patterns)",
    description: "Uses :g command for deletion and substitution",
    keystrokes: String.raw`:%g/^#/d<CR>:%g/^$/d<CR>:%s/\(.*\)=\(.*\)/    "\1": "\2",/g<CR>ggO{<Esc>G$xGo}<Esc>`,
  },
  {
    name: "visual-block-approach",
    description: "Uses visual block mode for transformations",
    keystrokes: String.raw`:g/^#/d<CR>:g/^$/d<CR>ggO{<CR><Esc>Go}<Esc>2G:%s/^\([^=]*\)=\(.*\)$/    "\1": "\2",/<CR>G2kf,$x`,
  },
];

// Helper function to replay keystrokes using our engine
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

// Enable real Vim parity checking
process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

describe("Challenge 9v00680e54330000000006c0 - env to json parity", () => {
  // Test each solution from challenge-solutions.json for vim parity
  solutions.forEach(({ name, keystrokes }) => {
    it(`${name} - engine matches nvim output`, async () => {
      const parityResult = await runVimParityAsync({
        startText,
        keystrokes,
        vimBin: "nvim",
        timeoutMs: 5000,
      });

      // Key assertion: our engine must produce the same output as real nvim
      if (parityResult.engineNormalized !== parityResult.vimNormalized) {
        console.log(`\n=== Mismatch for ${name} ===`);
        console.log(
          "Engine output:",
          JSON.stringify(parityResult.engineNormalized.slice(0, 200))
        );
        console.log(
          "Vim output:   ",
          JSON.stringify(parityResult.vimNormalized.slice(0, 200))
        );
      }
      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });

  // Test additional solutions
  additionalSolutions.forEach(({ name, keystrokes }) => {
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
          "Engine output:",
          JSON.stringify(parityResult.engineNormalized.slice(0, 200))
        );
        console.log(
          "Vim output:   ",
          JSON.stringify(parityResult.vimNormalized.slice(0, 200))
        );
      }
      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });
});

describe("Challenge 9v00680e54330000000006c0 - specific command parity", () => {
  // Test individual vim commands used in the solutions
  const commandTests = [
    {
      name: ":g/^#/d - delete lines starting with #",
      keystrokes: ":g/^#/d<CR>",
    },
    {
      name: ":g/^$/d - delete empty lines",
      keystrokes: ":g/^$/d<CR>",
    },
    {
      name: ":%s with backreferences",
      keystrokes: String.raw`:%s/\([^=]*\)=\(.*\)/"\1": "\2",/<CR>`,
    },
    {
      name: ":%s/^# .*\\n//g - delete comment lines with newline",
      keystrokes: String.raw`:%s/^# .*\n//g<CR>`,
    },
    {
      name: ":$s/,$// - remove trailing comma from last line",
      keystrokes: String.raw`:g/^#/d<CR>:g/^$/d<CR>:%s/\([^=]*\)=\(.*\)/"\1": "\2",/<CR>:$s/,$/<CR>`,
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

describe("Challenge 9v00680e54330000000006c0 - motion and insert parity", () => {
  // Test basic motions and insert operations used in solutions
  const motionTests = [
    {
      name: "ggO{ - open line above and insert {",
      keystrokes: "ggO{<Esc>",
      shouldPass: true,
    },
    {
      name: "Go} - go to end, open line below and insert }",
      keystrokes: "Go}<Esc>",
      shouldPass: true,
    },
    {
      name: "G$hx - go to end, move to last char, move left, delete",
      keystrokes: "G$hx",
      shouldPass: true,
    },
    {
      name: "G$h x - similar but with space before x",
      keystrokes: "G$h x",
      shouldPass: true,
    },
  ];

  motionTests.forEach(({ name, keystrokes }) => {
    it(`${name} - matches nvim`, async () => {
      const parityResult = await runVimParityAsync({
        startText,
        keystrokes,
        vimBin: "nvim",
        timeoutMs: 2000,
      });

      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });

  // Test for gg}dk combination - was known failure before } motion fix
  it("gg}dk - go to top, move to next paragraph, delete line up - matches nvim", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: "gg}dk",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});

describe("Challenge 9v00680e54330000000006c0 - isolated paragraph motion tests", () => {
  // Simpler tests to isolate the } motion issue
  const simpleText = `line1
line2
line3

line4
line5

line6
`;

  it("} motion alone - moves to next empty line", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "}",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("}} motion - moves past two paragraphs", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "}}",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("d} motion - delete to next paragraph", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "d}",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("gg} motion - go to top then next paragraph", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "gg}",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("dk - delete line upward", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "jdk", // go down one line, then delete current and above
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("gg}dk - full sequence on simple text", async () => {
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: "gg}dk",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    if (parityResult.engineNormalized !== parityResult.vimNormalized) {
      console.log("\n=== gg}dk Parity Analysis ===");
      console.log("Start text:", JSON.stringify(simpleText));
      console.log(
        "Engine result:",
        JSON.stringify(parityResult.engineNormalized)
      );
      console.log("Vim result:", JSON.stringify(parityResult.vimNormalized));
    }

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});

describe("Challenge 9v00680e54330000000006c0 - macro recording tests", () => {
  const simpleText = `key1=value1
key2=value2
key3=value3
`;

  it("simple macro recording and replay", async () => {
    // Record macro to transform key=value to "key": "value"
    const parityResult = await runVimParityAsync({
      startText: simpleText,
      keystrokes: 'qa0i"<Esc>f=r"a: "<Esc>A",<Esc>jq@a@a',
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    if (parityResult.engineNormalized !== parityResult.vimNormalized) {
      console.log("\n=== Macro Parity Analysis ===");
      console.log(
        "Engine result:",
        JSON.stringify(parityResult.engineNormalized)
      );
      console.log("Vim result:", JSON.stringify(parityResult.vimNormalized));
    }

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});
