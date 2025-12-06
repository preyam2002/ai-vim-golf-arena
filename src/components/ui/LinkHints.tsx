"use client";

import React from "react";

type Hint = {
  key: string;
  x: number;
  y: number;
};

type Props = {
  active: boolean;
  hints: Hint[];
  buffer: string;
};

export function LinkHints({ active, hints, buffer }: Props) {
  if (!active) return null;
  return (
    <div className="vim-hints-layer" data-vim-ignore="true" aria-hidden="true">
      {hints.map((hint) => (
        <div
          key={hint.key}
          className="vim-hint"
          style={{ left: hint.x, top: hint.y }}
        >
          {hint.key.toUpperCase()}
        </div>
      ))}
      {buffer ? <div className="vim-hint-buffer">[{buffer}]</div> : null}
    </div>
  );
}

