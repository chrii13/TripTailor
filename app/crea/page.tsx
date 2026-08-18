import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";
import { decodeCreaPrefill, type CreaSearchParams } from "@/lib/crea-query-params";

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
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-accent"
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
