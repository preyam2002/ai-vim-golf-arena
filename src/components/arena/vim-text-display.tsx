"use client";

import { useEffect, useRef } from "react";
import { formatToken } from "@/lib/vim-engine";
import type { VimState } from "@/lib/vim-engine";

interface VimTextDisplayProps {
  state: VimState;
  className?: string;
}

export function VimTextDisplay({ state, className = "" }: VimTextDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to cursor
  useEffect(() => {
    // console.log(
    //   `[VimTextDisplay] Cursor update: line=${state.cursorLine}, col=${state.cursorCol}`
    // );
    if (containerRef.current) {
      const cursorElement = containerRef.current.querySelector(".vim-cursor");
      if (cursorElement) {
        const scrolloff = state.options?.scrolloff || 0;
        if (scrolloff <= 0) {
          cursorElement.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const cursorRect = cursorElement.getBoundingClientRect();
        const lineHeight =
          parseFloat(
            getComputedStyle(cursorElement as HTMLElement).lineHeight || "0"
          ) || 16;
        const margin = scrolloff * lineHeight;

        const topGap = cursorRect.top - containerRect.top;
        if (topGap < margin) {
          container.scrollTop -= margin - topGap;
        } else {
          const bottomGap = containerRect.bottom - cursorRect.bottom;
          if (bottomGap < margin) {
            container.scrollTop += margin - bottomGap;
          }
        }
      }
    }
  }, [state.cursorLine, state.cursorCol, state.options?.scrolloff]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-black/90 font-mono text-sm text-zinc-100 ${className}`}
      style={{ fontFamily: '"Fira Code", monospace' }}
    >
      <div className="flex-1 overflow-auto p-4 min-w-max flex">
        {/* Line Numbers Gutter */}
        {state.options?.number && (
          <div className="flex flex-col text-right pr-3 select-none text-zinc-700 border-r border-white/5 mr-3 bg-black/20">
            {state.lines.map((_, i) => (
              <div
                key={i}
                className={`${
                  i === state.cursorLine ? "text-zinc-400 font-bold" : ""
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {state.lines.map((line, lineIndex) => (
            <div key={lineIndex} className="relative whitespace-pre">
              {(() => {
                const matches =
                  state.options?.hlsearch && state.searchState.lastMatches
                    ? state.searchState.lastMatches.filter(
                        (m) => m.line === lineIndex
                      )
                    : [];
                const matchedColumns = new Set<number>();
                matches.forEach((m) => {
                  for (let c = m.col; c < m.col + m.length; c++) {
                    matchedColumns.add(c);
                  }
                });

                if (line.length === 0) {
                  return lineIndex === state.cursorLine ? (
                    <span className="vim-cursor inline-block w-[1ch] bg-zinc-400/80 text-black animate-[pulse_1s_ease-in-out_infinite]">
                      &nbsp;
                    </span>
                  ) : (
                    <span>&nbsp;</span>
                  );
                }

                return (
                  <>
                    {line.split("").map((char, colIndex) => {
                      const isCursor =
                        lineIndex === state.cursorLine &&
                        colIndex === state.cursorCol;
                      const isMatch =
                        !isCursor &&
                        state.options?.hlsearch &&
                        matchedColumns.has(colIndex);
                      return (
                        <span
                          key={colIndex}
                          className={`${
                            isCursor
                              ? "vim-cursor inline-block bg-zinc-400/80 text-black animate-[pulse_1s_ease-in-out_infinite]"
                              : isMatch
                              ? "bg-amber-500/30"
                              : ""
                          }`}
                        >
                          {char}
                        </span>
                      );
                    })}
                    {/* Cursor at end of line */}
                    {lineIndex === state.cursorLine &&
                      state.cursorCol === line.length && (
                        <span className="vim-cursor inline-block w-[1ch] bg-zinc-400/80 text-black animate-[pulse_1s_ease-in-out_infinite]">
                          &nbsp;
                        </span>
                      )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Status Line or Command Line */}
      <div className="w-full bg-zinc-900/80 border-t border-white/5 px-2 py-1 text-xs text-zinc-500 font-mono min-h-[24px] flex items-center shrink-0 z-10 backdrop-blur-sm">
        {state.commandLine !== null ? (
          <span className="text-zinc-100 font-bold flex items-center w-full">
            <span className="mr-1 text-blue-400">:</span>
            {state.commandLine}
            <span className="inline-block w-[0.6em] h-[1.2em] bg-zinc-400 ml-1 animate-pulse" />
          </span>
        ) : (
          <div className="flex justify-between w-full">
            <span className="font-bold text-blue-400">
              {state.mode.toUpperCase()}
            </span>
            <div className="flex items-center gap-3">
              {state.options?.showcmd && state.commandBuffer.length > 0 && (
                <span className="text-zinc-300">
                  {state.commandBuffer.map((token) => formatToken(token)).join("")}
                </span>
              )}
              {state.options?.ruler && (
                <span>
                  {state.cursorLine + 1},{state.cursorCol + 1}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
