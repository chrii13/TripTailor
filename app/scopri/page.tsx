import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DiscoverForm } from "@/components/discover-trips/discover-form";
import { OG_IMAGE } from "@/lib/site-metadata";

const TITLE = "Parti dal budget, non dalla meta";
const DESCRIPTION =
  "Non sai dove andare? Dicci quanto puoi spendere, quando e con chi parti: ti mostriamo 5 proposte di viaggio, ognuna con i costi stimati di viaggio, alloggio e spese in loco.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/scopri" },
  // openGraph/twitter definiti qui sostituiscono in blocco quelli del layout,
  // e insieme disattivano la convenzione file `app/opengraph-image.tsx`:
  // vanno ripetuti tutti i campi comuni, immagine completa compresa.
  openGraph: {
    title: `${TITLE} — TripTailor`,
    description: DESCRIPTION,
    url: "/scopri",
    siteName: "TripTailor",
    locale: "it_IT",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — TripTailor`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function Scopri() {
  return (
    <div className="min-h-screen bg-secondary">
      <header className="sticky top-0 z-20 bg-secondary">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-5 sm:px-0">
          {/* `after:` estende l'area toccabile del logo: il testo da solo è alto
              20px, sotto il minimo di 24px richiesto da WCAG 2.5.8. Stessa
              soluzione già usata in components/landing/site-nav.tsx. */}
          <Link
            href="/"
            className="relative font-display text-sm font-[725] tracking-[0.15em] whitespace-nowrap text-primary uppercase transition-opacity after:absolute after:-inset-x-2 after:-inset-y-2 after:rounded-full after:content-[''] hover:opacity-70"
          >
            TripTailor
          </Link>
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium text-primary sm:py-2 transition-colors hover:border-primary hover:bg-accent"
          >
            <ArrowLeft className="size-4 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-0">
        <DiscoverForm />
      </main>
    </div>
  );
}
