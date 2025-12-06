import { Keyboard, Trophy, Zap } from "lucide-react";

const items = [
  {
    icon: Trophy,
    title: "Curated challenges",
    copy: "Hand-picked VimGolf rounds so you can jump in fast.",
    accent: "from-primary/40 to-primary/10",
  },
  {
    icon: Zap,
    title: "Stack your roster",
    copy: "Choose the models you want to watch or battle with.",
    accent: "from-cyan-400/40 to-sky-500/15",
  },
  {
    icon: Keyboard,
    title: "Study the flow",
    copy: "Review keystrokes without distractions—just the buffer and time.",
    accent: "from-amber-400/40 to-orange-500/15",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 lg:px-8">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            why this arena
          </p>
          <h2 className="font-display text-2xl text-white sm:text-3xl">
            Only the essentials
          </h2>
          <p className="text-sm text-muted-foreground">
            No fluff—just the key reasons to play or watch a challenge.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl border border-border bg-background/60 p-4"
              >
                <div
                  className={`absolute inset-0 opacity-60 blur-3xl bg-gradient-to-br ${item.accent}`}
                />
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-secondary text-primary">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="relative mt-3 font-display text-lg text-white">
                  {item.title}
                </h3>
                <p className="relative mt-1 text-sm text-muted-foreground">
                  {item.copy}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
