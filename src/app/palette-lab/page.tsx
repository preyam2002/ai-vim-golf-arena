"use client";

const palettes = [
  {
    id: "cyan-fuchsia",
    name: "Midnight Cyan & Fuchsia",
    tokens: {
      primary: "oklch(0.78 0.20 230)",
      accent: "oklch(0.74 0.24 340)",
      secondary: "oklch(0.18 0.015 260)",
    },
  },
  {
    id: "obsidian-lime",
    name: "Obsidian Lime Pulse",
    tokens: {
      primary: "oklch(0.78 0.20 135)", // lime
      accent: "oklch(0.74 0.10 260)", // indigo steel
      secondary: "oklch(0.20 0.015 250)", // coal
    },
  },
  {
    id: "amber-teal",
    name: "Terminal Amber & Teal",
    tokens: {
      primary: "oklch(0.78 0.18 80)",
      accent: "oklch(0.74 0.14 190)",
      secondary: "oklch(0.20 0.02 260)",
    },
  },
  {
    id: "mint-plum",
    name: "Mint & Deep Plum",
    tokens: {
      primary: "oklch(0.80 0.12 170)", // mint
      accent: "oklch(0.55 0.18 320)", // plum
      secondary: "oklch(0.22 0.02 260)", // ink
    },
  },
  {
    id: "arctic-lime",
    name: "Arctic Blue & Lime",
    tokens: {
      primary: "oklch(0.82 0.16 240)",
      accent: "oklch(0.78 0.20 135)",
      secondary: "oklch(0.22 0.015 260)",
    },
  },
  {
    id: "jade-copper",
    name: "Jade & Oxidized Copper",
    tokens: {
      primary: "oklch(0.72 0.16 170)", // jade
      accent: "oklch(0.70 0.15 75)", // copper amber
      secondary: "oklch(0.19 0.02 250)", // dark slate
    },
  },
  {
    id: "violet-tangerine",
    name: "Violet & Tangerine",
    tokens: {
      primary: "oklch(0.78 0.20 300)",
      accent: "oklch(0.78 0.21 50)",
      secondary: "oklch(0.21 0.02 260)",
    },
  },
  {
    id: "graphite-ice",
    name: "Graphite & Glacier Ice",
    tokens: {
      primary: "oklch(0.82 0.12 240)", // glacier
      accent: "oklch(0.70 0.06 260)", // smoked lavender
      secondary: "oklch(0.17 0.01 250)", // graphite
    },
  },
];

export default function PaletteLabPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            palette lab
          </p>
          <h1 className="font-display text-3xl text-white">
            Quick preview of theme options
          </h1>
          <p className="text-sm text-muted-foreground">
            Each card overrides CSS variables locally. Pick a combo and we can
            promote it to the global theme.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {palettes.map((palette) => (
            <div
              key={palette.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-lg shadow-[0_30px_80px_-70px_rgba(0,0,0,0.8)]"
              style={{
                ["--primary" as any]: palette.tokens.primary,
                ["--accent" as any]: palette.tokens.accent,
                ["--secondary" as any]: palette.tokens.secondary,
              }}
            >
              <div className="absolute inset-0 opacity-50 blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    option
                  </p>
                  <h2 className="font-display text-xl text-white">
                    {palette.name}
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {palette.id}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Swatch label="Primary" className="bg-[var(--primary)] text-black" />
                <Swatch label="Accent" className="bg-[var(--accent)] text-black" />
                <Swatch
                  label="Secondary"
                  className="bg-[var(--secondary)] text-white/90"
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-r from-[var(--primary)]/20 via-black/40 to-[var(--accent)]/25 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  CTA preview
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground,black)] shadow-[0_12px_40px_-20px_var(--primary)]">
                    Primary
                  </button>
                  <button className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground hover:border-[var(--accent)]/50">
                    Ghost
                  </button>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                    • Live
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <TokenChip label="Primary" value={palette.tokens.primary} />
                <TokenChip label="Accent" value={palette.tokens.accent} />
                <TokenChip label="Secondary" value={palette.tokens.secondary} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 h-10 w-full rounded-lg border border-white/10 ${className}`} />
    </div>
  );
}

function TokenChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[11px] text-foreground break-all">
        {value}
      </div>
    </div>
  );
}

