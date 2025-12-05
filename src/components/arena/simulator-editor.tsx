"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createInitialState,
  executeKeystroke,
  type VimState,
} from "@/lib/vim-engine";
import { VimTextDisplay } from "./vim-text-display";

interface SimulatorEditorProps {
  startText: string;
  onFinish: (text: string) => void;
  onKeystroke?: (count: number, key: string) => void;
}

export function SimulatorEditor({
  startText,
  onFinish,
  onKeystroke,
}: SimulatorEditorProps) {
  const [state, setState] = useState<VimState>(() =>
    createInitialState(startText)
  );
  const [isReady, setIsReady] = useState(false);
  const keystrokeCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onFinishRef = useRef(onFinish);

  // Update ref when onFinish changes
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Initialize
  useEffect(() => {
    setState(createInitialState(startText));
    keystrokeCountRef.current = 0;
    setIsReady(true);
  }, [startText]);

  const translateKey = useCallback((e: { key: string; ctrlKey: boolean; metaKey: boolean; }) => {
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
  }, []);

  const processKeystroke = useCallback(
    (keystroke: string) => {
      keystrokeCountRef.current += 1;
      const currentCount = keystrokeCountRef.current;
      onKeystroke?.(currentCount, keystroke);
      setState((prev) => executeKeystroke(prev, keystroke));
    },
    [onKeystroke]
  );

  // Handle keyboard input (React handler on the hidden input + container capture)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement> | KeyboardEvent) => {
      const ks = translateKey(e);
      if (!ks) return;
      e.preventDefault();
      e.stopPropagation();
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
      processKeystroke(ks);
    },
    [processKeystroke, translateKey]
  );

  // Global capture to catch Ctrl/Cmd+V even if focus drifts
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // If the hidden input already has focus, let the React handler handle it to avoid double-processing
      if (inputRef.current && e.target === inputRef.current) return;
      handleKeyDown(e);
    };
    document.addEventListener("keydown", listener, true);
    return () => document.removeEventListener("keydown", listener, true);
  }, [handleKeyDown]);

  // Handle submit (called when user wants to submit their solution)
  const handleSubmit = useCallback(() => {
    const text = state.lines.join("\n");
    onFinishRef.current(text);
  }, [state.lines]);

  // Expose submit for parent/global trigger (used by toolbar button)
  useEffect(() => {
    (window as any).vimSubmit = handleSubmit;
    return () => {
      if ((window as any).vimSubmit === handleSubmit) {
        delete (window as any).vimSubmit;
      }
    };
  }, [handleSubmit]);

  // Focus input on container click
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Focus input on mount
  useEffect(() => {
    if (isReady) {
      inputRef.current?.focus();
    }
  }, [isReady]);

  return (
    <div
      ref={containerRef}
      className="neon-card relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded-2xl bg-black/70 border border-white/10 cursor-text backdrop-blur-lg shadow-[0_30px_90px_-70px_var(--primary)]"
      onClick={handleContainerClick}
      onKeyDownCapture={handleKeyDown as any}
      tabIndex={0}
      onPaste={(e) => e.preventDefault()}
    >
      {/* Loading Overlay */}
      {!isReady && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse"></div>
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute w-16 h-16 border-4 border-white/10 rounded-full"></div>
              <div className="absolute w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
              <svg
                className="w-6 h-6 text-primary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7.5 21l4.5-4.5L7.5 12V8l8 8-8 8z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-white/80">
            Initializing Vim...
          </p>
        </div>
      )}

      {/* Hidden input for capturing keyboard events */}
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 w-0 h-0"
        onKeyDown={handleKeyDown}
        onPaste={(e) => e.preventDefault()}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        tabIndex={0}
      />

      {/* Vim Display */}
      <VimTextDisplay state={state} className="h-full" />

      {/* Submit Button */}
      <div className="absolute bottom-4 right-4 z-50">
        <button
          onClick={handleSubmit}
          disabled={!isReady}
          className={`group relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-all duration-300 ${
            isReady
              ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-[0_20px_60px_-30px_var(--primary)] hover:-translate-y-0.5 active:scale-95"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
          <span className="relative flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Submit Solution
          </span>
        </button>
      </div>

    </div>
  );
}
