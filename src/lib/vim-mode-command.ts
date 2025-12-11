import { VimState } from "./vim-types";
import { executeKeystrokeInternal } from "./vim-engine";
import { performSearch } from "./vim-search";
import { evaluateVimExpression } from "./vim-ex-commands";

function updateIncrementalSearch(state: VimState) {
  if (!state.options.incsearch || !state.commandLine) return;

  const isSearch =
    state.commandLine.startsWith("/") || state.commandLine.startsWith("?");
  if (!isSearch) return;

  const pattern = state.commandLine.slice(1);
  const direction = state.commandLine.startsWith("/") ? "forward" : "backward";

  if (pattern.length === 0) {
    state.searchState.pattern = "";
    state.searchState.lastMatches = [];
    state.searchState.currentMatchIndex = -1;
    return;
  }

  const matches = performSearch(
    state.lines,
    pattern,
    state.cursorLine,
    state.cursorCol,
    direction,
    state.options
  );

  state.searchState.pattern = pattern;
  state.searchState.direction = direction;
  state.searchState.lastMatches = matches;
  state.searchState.currentMatchIndex = matches.length ? 0 : -1;
}

export function handleCommandModeKeystroke(
  state: VimState,
  keystroke: string
): VimState {
  if (state.commandLine === null) return state;

  if (keystroke === "<Esc>") {
    state.commandLine = null;
    state.mode = "normal";
    return state;
  }
  if (keystroke === "<CR>" || keystroke === "<Enter>") {
    const cmd = state.commandLine;
    state.commandLine = null;

    // Handle expression register assignment/insertion
    if (cmd && cmd.startsWith("=")) {
      const expr = cmd.slice(1);
      state.registers["="] = expr; // Store expression
      try {
        const result = evaluateVimExpression(expr, { line: state.cursorLine });
        // For <C-r>=, we assume return to insert mode and insert result
        state.mode = "insert";
        for (const char of result) {
          state = executeKeystrokeInternal(state, char);
        }
      } catch (e) {
        state.mode = "normal"; // On error, return to normal
        console.warn("Expression evaluation failed", e);
      }
      return state;
    }

    state.mode = "normal"; // Reset mode before executing command
    if (cmd === null) return state;
    const isSearch = cmd.startsWith("/") || cmd.startsWith("?");
    const full = isSearch ? `${cmd}<CR>` : `:${cmd}<CR>`;
    return executeKeystrokeInternal(state, full);
  }
  if (keystroke === "<BS>" || keystroke === "<Backspace>") {
    state.commandLine = state.commandLine.slice(0, -1);
    updateIncrementalSearch(state);
    return state;
  }
  // Append raw keystroke text for anything that's not handled above (including <C-R>)
  state.commandLine += keystroke;
  updateIncrementalSearch(state);
  return state;
}
