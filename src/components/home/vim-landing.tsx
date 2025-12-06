"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Command, SplitSquareVertical, Terminal } from "lucide-react";
import {
  KeystrokeConvergence,
  type KeystrokeConvergenceHandle,
} from "./keystroke-convergence";
import { motion } from "framer-motion";

const promptLines = [
  { prefix: "❯", text: " vi arena.vim", tone: "text-emerald-300" },
  { prefix: "~", text: " :set nu rnu cursorline", tone: "text-sky-200" },
  { prefix: "~", text: " /precision", tone: "text-amber-200" },
  { prefix: "~", text: " :wq", tone: "text-rose-200" },
];

const shortcutItems = [
  { keys: ["h", "j", "k", "l"], label: "Navigate like a laser", note: "home row orbit", accent: "from-emerald-400/40 to-cyan-500/20" },
  { keys: ["yy"], label: "Yank the universe", note: "copy line + register glow", accent: "from-sky-400/40 to-indigo-500/20" },
  { keys: ["dd"], label: "Delete with intent", note: "slice lines cleanly", accent: "from-amber-400/40 to-orange-500/20" },
  { keys: [":wq"], label: "Write & quit", note: "stateful statusline", accent: "from-rose-400/40 to-fuchsia-500/20" },
  { keys: ["/", "n"], label: "Search + next", note: "pattern tracing", accent: "from-teal-400/40 to-lime-500/20" },
  { keys: [":help"], label: "Get curious", note: "pull up docs inline", accent: "from-purple-400/40 to-pink-500/20" },
];

const panes = [
  { title: "main.lua", body: ["local arena = require('vim.arena')", "arena.start({ mode = 'blackout' })", "arena.stream_keystrokes(true)"], status: "-- INSERT --", accent: "from-emerald-500/20 to-emerald-300/10" },
  { title: "quickfix", body: ["1 matches found", "[1] precision challenge ready", "[2] ghost cursor armed"], status: "-- NORMAL --", accent: "from-sky-500/20 to-cyan-300/10" },
  { title: "help vim-arena", body: [":ArenaOpen  Launch the challenge UI", ":ArenaKeystrokes  Toggle overlay", ":ArenaStatus  Show current mode"], status: "-- HELP --", accent: "from-amber-500/20 to-orange-300/10" },
];

function Keycap({ children }: { children: string }) {
  return (
    <span className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs uppercase tracking-[0.12em] text-foreground shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]">
      {children}
    </span>
  );
}

export function VimLandingHero() {
  const convergenceRef = useRef<KeystrokeConvergenceHandle>(null);

  return (
    <section className="relative isolate overflow-hidden px-6 pt-20 pb-24 lg:px-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.12),transparent_42%),radial-gradient(circle_at_78%_12%,rgba(59,130,246,0.12),transparent_38%),radial-gradient(circle_at_50%_72%,rgba(244,114,182,0.1),transparent_40%)]" />
        <div className="absolute inset-6 rounded-[46px] border border-white/5 bg-linear-to-br from-white/5 via-transparent to-primary/5 blur-3xl" />
        <div className="absolute inset-0 opacity-30">
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:26px_26px]" />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:grid lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md">
            <span className="flex h-2 w-2 items-center justify-center rounded-full bg-primary shadow-[0_0_0_6px_rgba(16,185,129,0.2)]" />
            Vim Mode Locked
            <span className="inline-flex items-center gap-1 text-primary">
              <Terminal className="h-4 w-4" />
              :wq to commit
            </span>
          </div>

          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Enter <span className="text-primary">vi</span> and watch the arena boot.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            A landing page that thinks in motions and modes. We simulate a real buffer,
            surface keystrokes, and let the statusline narrate every move.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/challenge/daily"
              className="group relative inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_60px_-30px_var(--primary)] transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_25px_70px_-28px_var(--primary)]"
              onMouseEnter={() => convergenceRef.current?.pulse()}
              onFocus={() => convergenceRef.current?.pulse()}
              onClick={() => convergenceRef.current?.pulse()}
            >
              Launch daily
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#vim-shortcuts"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
            >
              See Vim flow
              <Command className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-sm text-foreground shadow-inner">
            {promptLines.map((line, idx) => (
              <motion.div
                key={line.text}
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.35 }}
              >
                <span className="text-muted-foreground">{line.prefix}</span>
                <span className={line.tone}>{line.text}</span>
                {idx === promptLines.length - 1 && (
                  <span className="ml-1 inline-flex h-5 w-2 animate-pulse bg-emerald-300/80" />
                )}
              </motion.div>
            ))}
            <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>-- NORMAL --</span>
              <span>BUF 1 · utf-8 · ln 42 col 3</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-3xl bg-linear-to-tr from-primary/30 via-transparent to-accent/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-b from-zinc-950/80 via-black/70 to-zinc-900/60 p-6 shadow-2xl">
            <KeystrokeConvergence
              ref={convergenceRef}
              className="pointer-events-none absolute inset-0 z-0 opacity-80 mix-blend-screen"
            />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-12 rounded-full bg-linear-to-r from-primary to-accent" />
                  live keystrokes
                </span>
                <span className="text-primary">00:00:42</span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/50 p-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <SplitSquareVertical className="h-4 w-4 text-primary" />
                    splits active
                  </span>
                  <span className="text-emerald-300">-- INSERT --</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {["ga", ":%s/slow/fast/g", "zz", "viw -> c"].map((cmd, i) => (
                    <motion.div
                      key={cmd}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.25 }}
                    >
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span>macro {i + 1}</span>
                        <span>ready</span>
                      </div>
                      <div className="mt-1 text-emerald-200">{cmd}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-linear-to-r from-primary/10 to-accent/10 px-4 py-3 text-sm text-white">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  statusline
                </span>
                <span className="font-semibold text-emerald-300">[Arena] NORMAL · 120fps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function VimShortcutsRail() {
  return (
    <section id="vim-shortcuts" className="mx-auto max-w-6xl px-6 pb-20 lg:px-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">playful motion</p>
          <h2 className="font-display text-2xl text-white sm:text-3xl">Vim shortcuts that feel alive</h2>
        </div>
        <Link
          href="/challenge/random"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
        >
          Shuffle a challenge
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcutItems.map((item, idx) => (
          <motion.div
            key={item.label}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * idx, duration: 0.25 }}
          >
            <div className={`pointer-events-none absolute inset-0 opacity-60 blur-3xl bg-linear-to-br ${item.accent}`} />
            <div className="relative flex flex-wrap items-center gap-2">
              {item.keys.map((key) => (
                <Keycap key={key}>{key}</Keycap>
              ))}
            </div>
            <h3 className="relative mt-3 font-display text-xl text-white">{item.label}</h3>
            <p className="relative mt-1 text-sm text-muted-foreground">{item.note}</p>
            <div className="relative mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              live keystroke capture
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function VimChromeShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-12">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_-90px_var(--primary)]">
        <div className="absolute inset-px rounded-[24px] border border-white/5" />
        <div className="absolute inset-0 opacity-30 blur-3xl">
          <div className="grid-overlay h-full w-full" />
        </div>

        <div className="relative space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deep integration</p>
              <h2 className="font-display text-2xl text-white sm:text-3xl">Statusline, splits, quickfix baked in</h2>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">-- NORMAL --</span>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">ln 128 col 7</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {panes.map((pane, idx) => (
              <div
                key={pane.title}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-4 shadow-inner"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className={`pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-linear-to-br ${pane.accent}`} />
                <div className="relative flex items-center justify-between border-b border-white/10 pb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>{pane.title}</span>
                  <span className="text-primary">{pane.status}</span>
                </div>
                <div className="relative mt-3 space-y-2 font-mono text-sm text-foreground">
                  {pane.body.map((line, lineIdx) => (
                    <div key={lineIdx} className="flex gap-3">
                      <span className="text-muted-foreground">~</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="relative rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-foreground">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">:wq</span>
              <span className="text-emerald-200">buffer written · saved to arena</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

