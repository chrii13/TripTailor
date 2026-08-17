import Link from "next/link";

import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";

export default function Crea() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4 sm:px-0">
          <Link
            href="/"
            className="font-display text-sm font-black tracking-[0.15em] text-primary uppercase"
          >
            TripTailor
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        <ItineraryForm />
      </main>
    </div>
  );
}
