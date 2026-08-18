import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { PopularDestinations } from "@/components/landing/popular-destinations";
import { SiteIdentity } from "@/components/landing/site-identity";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ReverseSearch } from "@/components/landing/reverse-search";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteNav />
      <Hero />
      <PopularDestinations />
      <SiteIdentity />
      <HowItWorks />
      <ReverseSearch />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}
