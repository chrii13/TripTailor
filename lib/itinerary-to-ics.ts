import { createEvents, type DateArray, type EventAttributes } from "ics";
import type { TripFormValues } from "@/lib/schema";
import type { Activity, ItineraryResponse } from "@/lib/itinerary-schema";

const SLOTS = ["mattina", "pomeriggio", "sera"] as const;

function toDateArray(date: string, time: string): DateArray {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return [year, month, day, hour, minute];
}

function buildDescription(activity: Activity): string {
  return [
    activity.description,
    `Costo: ${activity.estimatedCost}`,
    `Come arrivare: ${activity.details.gettingThere}`,
    `Consigli: ${activity.details.tips}`,
  ].join("\n");
}

export function buildItineraryIcs(tripData: TripFormValues, itinerary: ItineraryResponse): string {
  const events: EventAttributes[] = [];

  for (const day of itinerary.days) {
    for (const slot of SLOTS) {
      for (const activity of day[slot]) {
        // Stesse varianti che accetta lo schema: i tre trattini (ASCII, en dash, em dash),
        // con o senza spazi attorno o ai bordi della stringa.
        const [startTime, endTime] = activity.suggestedTime.trim().split(/\s*[-–—]\s*/);

        events.push({
          start: toDateArray(day.date, startTime),
          end: toDateArray(day.date, endTime),
          // ics's default `startOutputType` is "utc", which converts the local wall-clock
          // times above using the current machine's timezone offset (adding a "Z" suffix).
          // We want floating local time instead (RFC 5545 form #1) so the event always
          // shows 09:00 regardless of which timezone the .ics file is opened in.
          startOutputType: "local",
          endOutputType: "local",
          title: activity.title,
          description: buildDescription(activity),
        });
      }
    }
  }

  const { error, value } = createEvents(events);

  if (error) {
    throw error;
  }

  return value ?? "";
}
