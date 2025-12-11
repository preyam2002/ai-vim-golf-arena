import {
  VimChromeShowcase,
  VimLandingHero,
  VimShortcutsRail,
} from "@/components/home/vim-landing";

export default function VimLandingTestPage() {
  return (
    <main className="min-h-screen bg-black text-foreground selection:bg-primary/20">
      <VimLandingHero />
      <VimShortcutsRail />
      <VimChromeShowcase />
    </main>
  );
}




