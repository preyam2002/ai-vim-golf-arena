export interface VimOptions {
  compatible: boolean;
  scrolloff: number;
  autoindent: boolean;
  showcmd: boolean;
  backup: boolean;
  number: boolean;
  ruler: boolean;
  hlsearch: boolean;
  incsearch: boolean;
  showmatch: boolean;
  ignorecase: boolean;
  smartcase: boolean;
  visualbell: boolean;
  backspace: {
    indent: boolean;
    eol: boolean;
    start: boolean;
  };
  runtimepath: string;
  syntax: boolean;
  filetype: {
    detection: boolean;
    indent: boolean;
  };
  terminalReverse: string;
}

export interface VimState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  mode:
    | "normal"
    | "insert"
    | "replace"
    | "visual"
    | "visual-line"
    | "visual-block"
    | "commandline";
  pendingOperator: string | null;
  registers: Record<string, string>;
  registerMetadata: Record<string, { isLinewise: boolean }>;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  lastChange: LastChange | null;
  searchState: SearchState;
  marks: Record<string, Mark>;
  visualStart: { line: number; col: number } | null;
  countBuffer: string;
  lastFindChar: FindChar | null;
  activeRegister: string | null;
  recordingMacro: string | null;
  macroBuffer: string;
  lastMacroRegister: string | null;
  commandBuffer: string[];
  lineAtCursorEntry: { line: number; content: string } | null;
  visualBlock: {
    startLine: number;
    endLine: number;
    col: number;
    insertStartIndex: number;
    append: boolean;
    usedB?: boolean;
  } | null;
  visualBlockWaitingInsert: boolean;
  visualBlockInsertBuffer: string;
  visualBlockInsertStart: number | null;
  visualBlockInsertEnd: number | null;
  insertRepeatCount: number;
  insertRepeatKeys: string[];
  commandLine: string | null;
  pendingMotion: string | null;
  options: VimOptions;
}

export interface HistoryEntry {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}

export interface LastChange {
  keys: string[];
  isChange?: boolean;
  count?: number;
}

export interface SearchState {
  pattern: string;
  direction: "forward" | "backward";
  lastMatches: SearchMatch[];
  currentMatchIndex: number;
}

export interface SearchMatch {
  line: number;
  col: number;
  length: number;
}

export interface Mark {
  line: number;
  col: number;
}

export interface FindChar {
  char: string;
  direction: "f" | "F" | "t" | "T";
}
