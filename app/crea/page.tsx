import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";

type CreaPageProps = {
  searchParams: Promise<{ destination?: string }>;
};

export default async function Crea({ searchParams }: CreaPageProps) {
  const { destination } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
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
        <ItineraryForm initialDestination={destination} />
      </div>
    </main>
  );
}
