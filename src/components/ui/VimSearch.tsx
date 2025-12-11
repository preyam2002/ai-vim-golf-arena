"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  query: string;
  onChange: (value: string) => void;
  onSubmit: (value?: string) => void;
  onClose: () => void;
  matchCount: number;
  activeIndex: number;
};

export function VimSearch({
  open,
  query,
  onChange,
  onSubmit,
  onClose,
  matchCount,
  activeIndex,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="vim-search-shell" data-vim-ignore="true">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(query);
        }}
        className="vim-search-form"
      >
        <span className="vim-search-slash">/</span>
        <input
          ref={inputRef}
          className="vim-search-input"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find text..."
        />
        <button type="submit" className="vim-search-action">
          Enter
        </button>
        <button
          type="button"
          className="vim-search-action"
          onClick={onClose}
        >
          Esc
        </button>
      </form>
      <div className="vim-search-meta">
        {matchCount > 0 ? (
          <span>
            {matchCount} match{matchCount > 1 ? "es" : ""} · n/N to cycle ·{" "}
            {activeIndex + 1}/{matchCount}
          </span>
        ) : (
          <span>Enter to highlight · Esc to cancel</span>
        )}
      </div>
    </div>
  );
}




