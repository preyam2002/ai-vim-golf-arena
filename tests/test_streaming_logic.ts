const {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} = require("./src/lib/vim-engine");

// Mock VimState interface since we can't import type easily with require in ts-node without setup
// We'll just use any for now or define a compatible interface
interface VimState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  mode: string;
  commandLine: string | null;
  [key: string]: any;
}

// Mock ReplayStep
interface ReplayStep {
  keystroke: string;
  text: string;
  cursorLine: number;
  cursorCol: number;
  mode: string;
  commandLine: string | null;
}

// Simulator state
interface Simulator {
  rawInput: string;
  processedIndex: number;
  vimState: VimState;
  steps: ReplayStep[];
}

function runSimulation(chunks: string[], label: string) {
  console.log(`\n=== Running Test: ${label} ===`);

  const startText = "foo";
  const sim: Simulator = {
    rawInput: "",
    processedIndex: 0,
    vimState: createInitialState(startText),
    steps: [],
  };

  for (const chunk of chunks) {
    console.log(`\n--- Receiving chunk: "${chunk}" ---`);
    sim.rawInput += chunk;

    let effectiveInput = sim.rawInput;
    // Simple markdown check (omitted for this test as we assume clean input for now)

    while (sim.processedIndex < effectiveInput.length) {
      const remaining = effectiveInput.slice(sim.processedIndex);
      const keystroke = extractKeystroke(remaining, sim.vimState.mode);

      if (!keystroke) {
        console.log(
          `  [Wait] extractKeystroke returned null for "${remaining}"`
        );
        break;
      }

      console.log(`  [Exec] keystroke: "${keystroke}"`);

      try {
        sim.vimState = executeKeystroke(sim.vimState, keystroke);
      } catch (e) {
        console.error("  [Error] executeKeystroke failed:", e);
        break;
      }

      const step: ReplayStep = {
        keystroke,
        text: sim.vimState.lines.join("\n"),
        cursorLine: sim.vimState.cursorLine,
        cursorCol: sim.vimState.cursorCol,
        mode: sim.vimState.mode,
        commandLine: sim.vimState.commandLine,
      };

      sim.steps.push(step);
      sim.processedIndex += keystroke.length;

      console.log(`  [State] commandLine: ${sim.vimState.commandLine}`);
    }
  }

  console.log("\n--- Final State ---");
  console.log("Steps:", sim.steps.length);
  console.log("Final CommandLine:", sim.vimState.commandLine);
  console.log("Final Text:", sim.vimState.lines.join("\n"));
}

function runTest() {
  runSimulation(
    [":", "%", "s", "/", "^", "/", "bar", "/", "<CR>"],
    "Single Chars"
  );
  runSimulation(
    [":%", "s", "/", "^", "/", "bar", "/", "<CR>"],
    "Split Ex Command (:% | s)"
  );
  runSimulation(
    [":%s", "/", "^", "/", "bar", "/", "<CR>"],
    "Combined Ex Command (:%s)"
  );
}

runTest();
