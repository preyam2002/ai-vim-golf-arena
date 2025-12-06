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
  const stateRef = useRef<VimState>(createInitialState(startText));
  const [isReady, setIsReady] = useState(false);
  const [keystrokeDisplay, setKeystrokeDisplay] = useState(0);
  const keystrokeCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onFinishRef = useRef(onFinish);
  const lastKeyRef = useRef<string | null>(null);
  const commandCaptureRef = useRef<string | null>(null);

  // Update ref when onFinish changes
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Initialize
  useEffect(() => {
    const initial = createInitialState(startText);
    stateRef.current = initial;
    setState(initial);
    keystrokeCountRef.current = 0;
    setIsReady(true);
  }, [startText]);

  const translateKey = useCallback(
    (e: { key: string; ctrlKey: boolean; metaKey: boolean }) => {
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
    },
    []
  );

  const processKeystroke = useCallback(
    (keystroke: string) => {
      keystrokeCountRef.current += 1;
      const currentCount = keystrokeCountRef.current;
      onKeystroke?.(currentCount, keystroke);
      setKeystrokeDisplay(currentCount);
      const prevState = stateRef.current;
      const nextState = executeKeystroke(prevState, keystroke);
      stateRef.current = nextState;

      // Capture command-line submits like :w
      const shouldSubmitFromCommand = (() => {
        // Clear on escape
        if (keystroke === "<Esc>") {
          commandCaptureRef.current = null;
          return false;
        }

        // Start capture from normal mode on :
        if (!commandCaptureRef.current) {
          if (prevState.mode === "normal" && keystroke === ":") {
            commandCaptureRef.current = ":";
          }
          return false;
        }

        // Handle backspace edits
        if (keystroke === "<BS>") {
          const trimmed =
            commandCaptureRef.current.length > 1
              ? commandCaptureRef.current.slice(0, -1)
              : null;
          commandCaptureRef.current = trimmed;
          return false;
        }

        // Finalize on <CR>
        if (keystroke === "<CR>") {
          const cmd = commandCaptureRef.current.slice(1).trim().toLowerCase();
          commandCaptureRef.current = null;
          return ["w"].includes(cmd);
        }

        // Append simple characters
        if (keystroke.length === 1 && !keystroke.startsWith("<")) {
          commandCaptureRef.current += keystroke;
        }
        return false;
      })();

      if (shouldSubmitFromCommand) {
        onFinishRef.current(nextState.lines.join("\n"));
        commandCaptureRef.current = null;
        lastKeyRef.current = null;
      } else {
        lastKeyRef.current = keystroke === "<Esc>" ? null : keystroke;
      }

      setState(nextState);
    },
    [onKeystroke]
  );

  // Handle submit (called when user wants to submit their solution)
  const handleSubmit = useCallback(() => {
    const text = stateRef.current.lines.join("\n");
    onFinishRef.current(text);
  }, []);

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
    [handleSubmit, processKeystroke, translateKey]
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
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded-2xl bg-black/80 border border-white/10 cursor-text backdrop-blur-lg shadow-none"
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
      <VimTextDisplay
        state={state}
        className="h-full"
        showStatusLine
        keystrokeCount={keystrokeDisplay}
        submitHint="Submit: :w"
      />
    </div>
  );
}
