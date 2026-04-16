import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
  normalizeText,
  countKeystrokes,
} from "../src/lib/vim-engine";

const START =
  "vimgolf:\n  logging:\n    level: INFO\napp:\n  postgres:\n    host: !ENV {POSTGRES_HOST}\n    port: !ENV {POSTGRES_PORT}\n  pulsar:\n    host: !ENV ${PULSAR_HOST}\n    port: !ENV ${PULSAR_PORT}\n    namespace: vimgolf\n    topic: !ENV ${PULSAR_TOPIC}\n";
const TARGET =
  "POSTGRES_HOST=\nPOSTGRES_PORT=\nPULSAR_HOST=\nPULSAR_PORT=\nPULSAR_TOPIC=\n";

function run(ks: string) {
  let state = createInitialState(START);
  let remaining = ks;
  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode);
    if (!stroke) break;
    state = executeKeystroke(state, stroke);
    remaining = remaining.slice(stroke.length);
  }
  return state.lines.join("\n");
}

const tests = [
  ":v/}/d<CR>:%s/.*{/<CR>:%s/}/=<CR>",
  ":v/}/d<CR>:%s/.*{/<CR>:%s/}/=/<CR>",
  ":v/}/d<CR>:%s/.*{\\|}//g<CR>:%s/$/=<CR>",
  ":g/}/s/.*{//\\|s/}/=/<CR>:v/=/d<CR>",
  ":g/}/s/.*{//<CR>:g/}/s/}/=<CR>:v/=/d<CR>",
  ":%s/.*{\\(.*\\)}.*/\\1=/<CR>:v/=/d<CR>",
  ":%s/\\v.*\\{(.*)\\}.*/\\1=/<CR>:v/=/d<CR>",
  ":v/}/d<CR>:%s/.*{//<CR>:%s/}/=<CR>",
];

for (const ks of tests) {
  const out = run(ks);
  const ok = normalizeText(out) === normalizeText(TARGET);
  console.log(`[${countKeystrokes(ks)}] ok=${ok}  ${JSON.stringify(ks)}`);
  if (!ok) console.log("  got:", JSON.stringify(out).slice(0, 160));
}
