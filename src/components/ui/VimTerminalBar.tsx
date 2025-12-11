"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialState,
  executeKeystroke,
  type VimState,
} from "@/lib/vim-engine";

const START_TEXT = [
  "Vim Terminal (mock) — type to edit buffer.",
  "Esc to leave insert mode; :q to quit buffer; :w not wired to disk.",
  "Supports basic motions, edits, search, macros from vim-engine.",
].join("\n");

function translateKey(e: { key: string; ctrlKey: boolean; metaKey: boolean }) {
  if (e.key === "Escape") return "<Esc>";
  if (e.key === "Enter") return "<CR>";
  if (e.key === "Backspace") return "<BS>";
  if (e.key === "Tab") return "<Tab>";
  if (e.key === "ArrowUp") return "<Up>";
  if (e.key === "ArrowDown") return "<Down>";
  if (e.key === "ArrowLeft") return "<Left>";
  if (e.key === "ArrowRight") return "<Right>";
  if (e.key === "Delete") return "<Del>";
  if ((e.ctrlKey || e.metaKey) && e.key.length === 1) {
    return `<C-${e.key.toLowerCase()}>`;
  }
  if (e.key.length === 1) return e.key;
  return null;
}

function renderLine(line: string, idx: number, state: VimState) {
  if (idx !== state.cursorLine) return line;
  const col = Math.min(state.cursorCol, Math.max(line.length, 0));
  const before = line.slice(0, col);
  const at = line[col] ?? " ";
  const after = line.slice(col + 1);
  return (
    <span key={idx} className="vim-term-line">
      {before}
      <span className="vim-term-cursor">{at}</span>
      {after}
    </span>
  );
}

export function VimTerminalBar() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VimState>(() => createInitialState(START_TEXT));
  const inputRef = useRef<HTMLInputElement>(null);

  const mode = useMemo(() => state.mode, [state.mode]);

  const processKeystroke = useCallback((ks: string) => {
    setState((prev) => executeKeystroke(prev, ks));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const ks = translateKey(e);
      if (!ks) return;
      e.preventDefault();
      e.stopPropagation();
      processKeystroke(ks);
    },
    [processKeystroke]
  );

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="vim-term-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        data-vim-ignore="true"
      >
        {open ? "Hide Vim" : "Show Vim"}
      </button>
      {open ? (
        <div className="vim-terminal" data-vim-ignore="true" data-vim-allow="true">
          <div className="vim-term-header">
            <span className="vim-term-title">Vim Terminal (mock)</span>
            <span className="vim-term-mode">Mode: {mode}</span>
          </div>
          <div className="vim-term-body" onClick={() => inputRef.current?.focus()}>
            <pre className="vim-term-pre">
              {state.lines.map((line, idx) => renderLine(line, idx, state))}
            </pre>
          </div>
          <input
            ref={inputRef}
            className="vim-term-input"
            onKeyDown={handleKeyDown}
            value=""
            onChange={() => {}}
            aria-label="Vim terminal input"
          />
        </div>
      ) : null}
    </>
  );
}




