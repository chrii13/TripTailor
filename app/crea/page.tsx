import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";
import { decodeCreaPrefill, type CreaSearchParams } from "@/lib/crea-query-params";
import { OG_IMAGE } from "@/lib/site-metadata";

const TITLE = "Crea il tuo itinerario";
const DESCRIPTION =
  "Destinazione, date, chi viaggia e budget: ricevi un itinerario giorno per giorno, con orari, costi e attività scelte su di te.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/crea" },
  // openGraph/twitter definiti qui sostituiscono in blocco quelli del layout,
  // e insieme disattivano la convenzione file `app/opengraph-image.tsx`:
  // vanno ripetuti tutti i campi comuni, immagine completa compresa.
  openGraph: {
    title: `${TITLE} — TripTailor`,
    description: DESCRIPTION,
    url: "/crea",
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

type CreaPageProps = {
  searchParams: Promise<CreaSearchParams>;
};

export default async function Crea({ searchParams }: CreaPageProps) {
  const prefill = decodeCreaPrefill(await searchParams);

  return (
    <div className="min-h-screen bg-secondary">
      {/* Non è una barra: è il fondo della pagina che resta fermo. Niente bordo,
          niente superficie propria, il contenuto ci scorre sotto. */}
      <div className="sticky top-0 z-20 bg-secondary">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-5 sm:px-0">
          <Link
            href="/"
            className="font-display text-sm font-[725] tracking-[0.15em] whitespace-nowrap text-primary uppercase transition-opacity hover:opacity-70"
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
      </div>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-0">
        <ItineraryForm prefill={prefill} />
      </main>
    </div>
  );
}
