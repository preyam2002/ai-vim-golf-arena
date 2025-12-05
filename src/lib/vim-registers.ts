export function getRegister(state: VimState, register: string): string {
  return state.registers[register] || "";
}

export function getRegisterMetadata(
  state: VimState,
  register: string
): { isLinewise: boolean } {
  return state.registerMetadata?.[register] || { isLinewise: false };
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
  isLinewise: boolean
) {
  state.registers[reg] = text;
  ensureMetadata(state);
  state.registerMetadata[reg] = { isLinewise };
}

function shiftNumberedRegisters(state: VimState) {
  for (let i = 9; i >= 2; i--) {
    state.registers[i.toString()] = state.registers[(i - 1).toString()] || "";
    ensureMetadata(state);
    state.registerMetadata[i.toString()] =
      state.registerMetadata[(i - 1).toString()] || { isLinewise: false };
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

  writeRegister(state, reg, text, isLinewise);
  if (reg !== '"') {
    writeRegister(state, '"', text, isLinewise);
  }

  // Yank always updates register 0 unless explicitly black-holed
  writeRegister(state, "0", text, isLinewise);
}

export function saveDeleteRegister(
  state: VimState,
  text: string,
  register?: string,
  isLinewise: boolean = false
): void {
  // Normalize linewise deletes that start on an empty line so repeated pastes
  // don't multiply leading blanks.
  if (isLinewise) {
    if (text.startsWith("\n")) {
      text = text.slice(1);
    }
    if (!text.endsWith("\n")) {
      text = `${text}\n`;
    }
  }
  const reg = register || state.activeRegister || '"';
  state.activeRegister = null;
  if (reg === "_") return; // black hole

  if (!register && reg === '"') {
    // Default delete: shift numbered registers and write to "1
    shiftNumberedRegisters(state);
    writeRegister(state, "1", text, isLinewise);
    writeRegister(state, '"', text, isLinewise);
  } else {
    writeRegister(state, reg, text, isLinewise);
    if (reg !== '"') {
      writeRegister(state, '"', text, isLinewise);
    }
  }
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
