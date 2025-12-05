import { HeroSection } from "@/components/home/hero-section";
import { ChallengeSelector } from "@/components/home/challenge-selector";
import { FeaturesSection } from "@/components/home/features-section";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      <HeroSection />
      <ChallengeSelector />
      <FeaturesSection />
    </main>
  );
}
