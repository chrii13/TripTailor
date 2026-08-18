import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";

type CreaPageProps = {
  searchParams: Promise<{ destination?: string }>;
};

export default async function Crea({ searchParams }: CreaPageProps) {
  const { destination } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4 sm:px-0">
          <Link
            href="/"
            className="font-display text-sm font-[725] tracking-[0.15em] whitespace-nowrap text-primary uppercase"
          >
            TripTailor
          </Link>
          <Button asChild size="sm" variant="outline" className="border-primary shadow-none">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        <ItineraryForm initialDestination={destination} />
      </main>
    </div>
  );
}
