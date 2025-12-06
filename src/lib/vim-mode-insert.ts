import { VimState } from "./vim-types";
import { clampCursor } from "./vim-utils";
import { executeKeystroke } from "./vim-engine"; // Circular dependency, but needed for replay

export function handleInsertModeKeystroke(
  state: VimState,
  keystroke: string
): VimState {
  if (keystroke === "<Esc>" || keystroke === "<C-c>") {
    const repeatCount = state.insertRepeatCount ?? 1;
    const repeatKeys = state.insertRepeatKeys ?? [];
    state.insertRepeatCount = 1;
    state.insertRepeatKeys = [];

    if (state.visualBlock) {
      const block = state.visualBlock;
      state.visualBlock = null;

      // Get keys typed during insert (excluding the current Esc)
      // commandBuffer includes the current Esc, so we slice up to -1
      const keys = state.commandBuffer.slice(block.insertStartIndex, -1);

      // Apply to other lines
      const currentLine = state.cursorLine;

      for (let i = block.startLine; i <= block.endLine; i++) {
        if (i === currentLine) continue;

        // Set up for insert
        state.cursorLine = i;
        const lineLen = state.lines[i].length;
        const targetCol = block.append ? lineLen : Math.min(lineLen, block.col);
        state.cursorCol = targetCol;
        state.mode = "insert";

        // Replay keys
        for (const key of keys) {
          // We call executeKeystroke recursively
          // Note: This modifies state in place because executeKeystroke returns a new state
          // but we are assigning it back to our local 'state' variable?
          // No, executeKeystroke returns a new state. We need to update our local state.
          state = executeKeystroke(state, key);
        }
        // Force exit insert mode for this line
        state.mode = "normal";
        state.cursorCol = Math.max(0, state.cursorCol - 1);
      }

      // Normalize cursor after block insert: top of block at its start column
      state.cursorLine = block.startLine;
      const line0 = state.lines[block.startLine] || "";
      state.cursorCol = Math.min(block.col, Math.max(0, line0.length - 1));
      state.visualBlockWaitingInsert = false;
      state.visualBlockInsertBuffer = "";
    }

    if (repeatCount > 1 && repeatKeys.length > 0) {
      for (let n = 1; n < repeatCount; n++) {
        for (const key of repeatKeys) {
          if (key === "<CR>" || key === "<Enter>") {
            const line = state.lines[state.cursorLine];
            const indent = state.options.autoindent
              ? line.match(/^\s*/)?.[0] || ""
              : "";
            const before = line.slice(0, state.cursorCol);
            const after = line.slice(state.cursorCol);
            state.lines[state.cursorLine] = before;
            state.lines.splice(state.cursorLine + 1, 0, indent + after);
            state.cursorLine++;
            state.cursorCol = indent.length;
          } else if (key.length === 1) {
            const line = state.lines[state.cursorLine];
            const isReplace = state.mode === "replace";
            if (isReplace && state.cursorCol < line.length) {
              state.lines[state.cursorLine] =
                line.slice(0, state.cursorCol) +
                key +
                line.slice(state.cursorCol + 1);
            } else {
              state.lines[state.cursorLine] =
                line.slice(0, state.cursorCol) + key + line.slice(state.cursorCol);
            }
            state.cursorCol++;
          }
        }
      }
    }

    state.mode = "normal";
    const lineLen = state.lines[state.cursorLine]?.length ?? 0;
    const desiredCol =
      repeatCount > 1
        ? state.cursorCol
        : Math.max(0, state.cursorCol - 1);
    state.cursorCol = Math.max(
      0,
      Math.min(desiredCol, Math.max(0, lineLen - 1))
    );
    clampCursor(state);

    // Save last change for dot repeat
    state.lastChange = {
      keys: [...state.commandBuffer],
      isChange: true,
    };
    state.commandBuffer = [];

    return state;
  }

  if (keystroke === "<BS>" || keystroke === "<Backspace>") {
    const line = state.lines[state.cursorLine];
    if (state.cursorCol > 0) {
      state.lines[state.cursorLine] =
        line.slice(0, state.cursorCol - 1) + line.slice(state.cursorCol);
      state.cursorCol--;
    } else if (state.cursorLine > 0) {
      // Join with previous line
      const prevLine = state.lines[state.cursorLine - 1];
      state.lines[state.cursorLine - 1] = prevLine + line;
      state.lines.splice(state.cursorLine, 1);
      state.cursorLine--;
      state.cursorCol = prevLine.length;
    }
    return state;
  }

  if (keystroke === "<CR>" || keystroke === "<Enter>") {
    const line = state.lines[state.cursorLine];
    const indent = state.options.autoindent
      ? line.match(/^\s*/)?.[0] || ""
      : "";
    const before = line.slice(0, state.cursorCol);
    const after = line.slice(state.cursorCol);
    state.lines[state.cursorLine] = before;
    state.lines.splice(state.cursorLine + 1, 0, indent + after);
    state.cursorLine++;
    state.cursorCol = indent.length;
    if (state.insertRepeatCount > 1) {
      state.insertRepeatKeys.push("<CR>");
    }
    return state;
  }

  if (keystroke.length === 1) {
    const line = state.lines[state.cursorLine];
    const isReplace = state.mode === "replace";

    if (isReplace && state.cursorCol < line.length) {
      state.lines[state.cursorLine] =
        line.slice(0, state.cursorCol) + keystroke + line.slice(state.cursorCol + 1);
    } else {
      state.lines[state.cursorLine] =
        line.slice(0, state.cursorCol) + keystroke + line.slice(state.cursorCol);
    }
    state.cursorCol++;
    if (state.insertRepeatCount > 1) {
      state.insertRepeatKeys.push(keystroke);
    }
  }

  return state;
}
