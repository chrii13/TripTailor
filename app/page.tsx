import type { Metadata } from "next";

import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { PopularDestinations } from "@/components/landing/popular-destinations";
import { SiteIdentity } from "@/components/landing/site-identity";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ReverseSearch } from "@/components/landing/reverse-search";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

// Titolo, descrizione e openGraph restano quelli del layout radice: qui serve
// solo il canonical, che il layout non può dichiarare (lo erediterebbero tutte
// le pagine).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    // SiteNav (<header>) e SiteFooter (<footer>) stanno FUORI da <main>: i ruoli
    // impliciti banner/contentinfo esistono solo se non sono discendenti di
    // main/article/section/aside, altrimenti degradano a generic e la pagina
    // resta senza landmark di intestazione e piè di pagina.
    <>
      <SiteNav />
      <main className="flex min-h-screen flex-col">
        <Hero />
        <PopularDestinations />
        <SiteIdentity />
        <HowItWorks />
        <ReverseSearch />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
