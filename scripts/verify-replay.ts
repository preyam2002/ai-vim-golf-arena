// Simulates the client's buffer + keystroke extraction + 1x/2x/5x playback
// scheduling against the real /api/stream response.

import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine";

const START =
  "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n";
const TARGET =
  "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC=\n";

async function main() {
  const res = await fetch("http://localhost:7001/api/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: "claude-opus-4-7",
      challengeId: "9v00674f1bfb00000000063d",
      startText: START,
      targetText: TARGET,
    }),
  });
  if (!res.body) throw new Error("no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const rawChars: { ch: string; ts: number }[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const p = JSON.parse(line.slice(6));
        if (p.type === "token" && p.content) {
          const ts = typeof p.timeMs === "number" ? p.timeMs : 0;
          for (const ch of p.content as string) rawChars.push({ ch, ts });
        }
      } catch {}
    }
    if (done) break;
  }

  const rawInput = rawChars.map((c) => c.ch).join("");
  const rawTs = rawChars.map((c) => c.ts);

  let state = createInitialState(START);
  const steps: { keystroke: string; ts: number }[] = [];
  let i = 0;
  while (i < rawInput.length) {
    const ks = extractKeystroke(rawInput.slice(i), state.mode);
    if (!ks) break;
    state = executeKeystroke(state, ks);
    const lastCharIdx = i + ks.length - 1;
    steps.push({ keystroke: ks, ts: rawTs[lastCharIdx] ?? 0 });
    i += ks.length;
  }

  console.log("keystrokes:", steps.length);
  console.log("keystroke ts:", steps.map((s) => s.ts).join(", "));

  const simulate = (speed: number) => {
    let total = 0;
    for (let j = 0; j < steps.length - 1; j++) {
      total += Math.max(0, (steps[j + 1].ts - steps[j].ts) / speed);
    }
    return total;
  };

  for (const s of [0.5, 1, 2, 5, 10, 25]) {
    console.log(`${s}x scheduled:`, simulate(s).toFixed(0), "ms");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
