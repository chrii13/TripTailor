import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParticipantType, TripFormValues } from "@/lib/schema";
import type { ItineraryResponse } from "@/lib/itinerary-schema";

interface ItineraryResultProps {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  onEdit: () => void;
}

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

export function ItineraryResult({ tripData, itinerary, onEdit }: ItineraryResultProps) {
  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">Il tuo itinerario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Destinazione: </span>
            {tripData.destination}
          </span>
          {tripData.dateRange.from && tripData.dateRange.to && (
            <span>
              <span className="text-muted-foreground">Date: </span>
              {format(tripData.dateRange.from, "dd/MM/yyyy")} - {format(tripData.dateRange.to, "dd/MM/yyyy")}
            </span>
          )}
          <span>
            <span className="text-muted-foreground">Viaggiatori: </span>
            {tripData.participants.map((p) => `${TYPE_LABELS[p.type]} (${p.age})`).join(", ")}
          </span>
          <span>
            <span className="text-muted-foreground">Budget: </span>
            {tripData.budget}€
          </span>
        </div>

        <div className="space-y-6">
          {itinerary.days.map((day, dayIndex) => {
            const parsedDate = new Date(day.date);
            const formattedDate = Number.isNaN(parsedDate.getTime())
              ? day.date
              : format(parsedDate, "dd/MM/yyyy");
            return (
              <div key={dayIndex} className="space-y-3">
                <h3 className="font-display text-lg font-semibold">
                  Giorno {dayIndex + 1} — {formattedDate}
                </h3>
                {SLOTS.map(
                  ({ key, label }) =>
                    day[key].length > 0 && (
                      <div key={key} className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{label}</p>
                        <ul className="space-y-2">
                          {day[key].map((activity, activityIndex) => (
                            <li key={activityIndex} className="rounded-md border p-3">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="font-medium">{activity.title}</span>
                                <span className="shrink-0 text-sm text-muted-foreground">
                                  {activity.estimatedCost}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                              {activity.openingHours && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Orari: {activity.openingHours}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
      </CardContent>
    </Card>
  );
}
