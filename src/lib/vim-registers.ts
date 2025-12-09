export function getRegister(state: VimState, register: string): string {
  return state.registers[register] || "";
}

export function getRegisterMetadata(
  state: VimState,
  register: string
): { isLinewise: boolean; fromDelete?: boolean } {
  return state.registerMetadata?.[register] || {
    isLinewise: false,
    fromDelete: false,
  };
}

function ensureMetadata(state: VimState) {
  if (!state.registerMetadata) {
    state.registerMetadata = {};
  }
}

function writeRegister(
  state: VimState,
  reg: string,
  text: string,
  isLinewise: boolean,
  fromDelete: boolean = false
) {
  state.registers[reg] = text;
  ensureMetadata(state);
  state.registerMetadata[reg] = { isLinewise, fromDelete };
}

function shiftNumberedRegisters(state: VimState) {
  for (let i = 9; i >= 2; i--) {
    state.registers[i.toString()] = state.registers[(i - 1).toString()] || "";
    ensureMetadata(state);
    state.registerMetadata[i.toString()] =
      state.registerMetadata[(i - 1).toString()] || {
        isLinewise: false,
        fromDelete: false,
      };
  }
}

export function saveYankRegister(
  state: VimState,
  text: string,
  register?: string,
  isLinewise: boolean = false
): void {
  const reg = register || state.activeRegister || '"';
  state.activeRegister = null;
  if (reg === "_") return; // black hole

  writeRegister(state, reg, text, isLinewise, false);
  if (reg !== '"') {
    writeRegister(state, '"', text, isLinewise, false);
  }

  // Yank always updates register 0 unless explicitly black-holed
  writeRegister(state, "0", text, isLinewise, false);
}

export function saveDeleteRegister(
  state: VimState,
  text: string,
  register?: string,
  isLinewise: boolean = false
): void {
  const reg = register ?? state.activeRegister ?? '"';
  state.activeRegister = null;
  if (reg === "_") return; // black hole

  // Normalize linewise deletes so subsequent pastes mirror Vim's newline handling.
  if (isLinewise) {
    if (text.startsWith("\n")) {
      text = text.slice(1);
    }
    if (!text.endsWith("\n")) {
      text = `${text}\n`;
    }
  }

  const crossesLine = isLinewise || text.includes("\n");

  // Explicit register (including when activeRegister is set): write there and update unnamed.
  if (register || reg !== '"') {
    writeRegister(state, reg, text, isLinewise, true);
    writeRegister(state, '"', text, isLinewise, true);
    return;
  }

  // Default delete with unnamed register:
  // - Multi-line OR multi-char deletes (dw, d2w, etc.) populate numbered registers.
  // - Truly small deletes (single character on one line) go to the small delete register "-".
  const isSmallDelete = !crossesLine && text.length === 1;
  if (!isSmallDelete) {
    shiftNumberedRegisters(state);
    writeRegister(state, "1", text, isLinewise, true);
  } else {
    writeRegister(state, "-", text, isLinewise, true);
  }
  writeRegister(state, '"', text, isLinewise, true);
}

export function saveToRegister(
  state: VimState,
  text: string,
  register?: string,
  isLinewise: boolean = false
): void {
  // Fallback legacy helper: behaves like yank
  saveYankRegister(state, text, register, isLinewise);
}

export function getFromRegister(state: VimState, register?: string): string {
  const reg = register || '"';
  return state.registers[reg] || "";
}
