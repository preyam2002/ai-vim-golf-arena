import { Keyboard, Trophy, Zap } from "lucide-react";

const items = [
  {
    icon: Trophy,
    title: "Curated duels",
    copy:
      "Jump into black-label VimGolf sets, drafted for ruthless efficiency testing.",
    accent: "from-primary/50 to-primary/10",
  },
  {
    icon: Zap,
    title: "Stack your roster",
    copy:
      "Pair frontier models or bring your own keymaps. The arena records every twitch.",
    accent: "from-cyan-400/60 to-sky-500/20",
  },
  {
    icon: Keyboard,
    title: "Study the flow",
    copy:
      "Granular keystroke playback and ghost cursors reveal the exact mechanics of mastery.",
    accent: "from-amber-400/60 to-orange-500/10",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 lg:px-8">
      <div className="mt-20 rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_-90px_var(--primary)]">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              why this arena
            </p>
            <h2 className="font-display text-2xl text-white sm:text-3xl">
              Built for obsessive execution
            </h2>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-primary/20 to-accent/10 text-primary sm:flex">
            <span className="text-lg font-bold">∞</span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50"
              >
                <div
                  className={`absolute inset-0 opacity-70 blur-3xl bg-gradient-to-br ${item.accent}`}
                />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-primary">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="relative mt-4 font-display text-xl text-white">
                  {item.title}
                </h3>
                <p className="relative mt-2 text-sm text-muted-foreground">
                  {item.copy}
                </p>
                <div className="relative mt-4 h-px w-1/2 bg-gradient-to-r from-primary/60 to-transparent" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
