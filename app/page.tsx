import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { PopularDestinations } from "@/components/landing/popular-destinations";
import { SiteIdentity } from "@/components/landing/site-identity";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCta } from "@/components/landing/final-cta";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteNav />
      <Hero />
      <PopularDestinations />
      <SiteIdentity />
      <HowItWorks />
      <FinalCta />
    </main>
  );
}
