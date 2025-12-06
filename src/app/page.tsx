import { ChallengeSelector } from "@/components/home/challenge-selector";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20 flex items-center justify-center">
      <ChallengeSelector />
    </main>
  );
}
