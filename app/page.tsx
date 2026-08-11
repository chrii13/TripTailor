import { ItineraryForm } from "@/components/itinerary-form/itinerary-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)] p-4 sm:p-8">
      <ItineraryForm />
    </main>
  );
}
