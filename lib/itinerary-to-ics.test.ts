import { describe, it, expect } from "vitest";
import { buildItineraryIcs } from "./itinerary-to-ics";
import type { TripFormValues } from "./schema";
import type { Activity, ItineraryResponse } from "./itinerary-schema";

const tripData: TripFormValues = {
  destination: "Kyoto",
  dateRange: { from: new Date("2026-09-01"), to: new Date("2026-09-02") },
  participants: [{ type: "adulto", age: 34 }],
  budget: 2000,
  styleNotes: "",
};

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    title: "Visita al tempio Kinkaku-ji",
    description: "Il celebre padiglione d'oro immerso nel giardino giapponese",
    estimatedCost: "500¥",
    suggestedTime: "09:00–11:00",
    details: {
      about: "Uno dei templi più fotografati del Giappone",
      gettingThere: "Autobus 101 o 205 dalla stazione di Kyoto",
      tips: "Arriva presto per evitare la folla",
    },
    ...overrides,
  };
}

const itinerary: ItineraryResponse = {
  days: [
    {
      date: "2026-09-01",
      mattina: [makeActivity()],
      pomeriggio: [makeActivity({ title: "Passeggiata nel bosco di bambù di Arashiyama", suggestedTime: "14:00–15:30" })],
      sera: [makeActivity({ title: "Cena nel quartiere di Gion", suggestedTime: "19:00–21:00" })],
    },
    {
      date: "2026-09-02",
      mattina: [makeActivity({ title: "Castello di Nijo", suggestedTime: "09:30–11:00" })],
      pomeriggio: [],
      sera: [],
    },
  ],
};

// L'ics generato applica il line-folding RFC 5545 (spezza le righe lunghe con
// "\r\n "); per confrontare sottostringhe di descrizioni lunghe, prima si "srotola".
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

describe("buildItineraryIcs", () => {
  it("produce una stringa iCalendar valida che inizia con BEGIN:VCALENDAR", () => {
    const result = buildItineraryIcs(tripData, itinerary);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("BEGIN:VCALENDAR");
  });

  it("crea un VEVENT per ogni attività, su tutti i giorni e le fasce orarie", () => {
    const result = buildItineraryIcs(tripData, itinerary);
    const eventCount = result.split("BEGIN:VEVENT").length - 1;
    expect(eventCount).toBe(4);
  });

  it("include il titolo di un'attività nota nel campo SUMMARY", () => {
    const result = buildItineraryIcs(tripData, itinerary);
    expect(result).toContain("SUMMARY:Visita al tempio Kinkaku-ji");
  });

  it("include costo, indicazioni e consigli nella descrizione dell'evento", () => {
    const result = unfold(buildItineraryIcs(tripData, itinerary));
    expect(result).toContain("Costo: 500¥");
    expect(result).toContain("Autobus 101 o 205 dalla stazione di Kyoto");
    expect(result).toContain("Arriva presto per evitare la folla");
  });

  it("usa l'orario locale in forma \"floating\" (nessuna conversione UTC, nessun suffisso Z)", () => {
    const result = buildItineraryIcs(tripData, itinerary);
    // La prima attività ha suggestedTime "09:00–11:00" il 2026-09-01: deve comparire
    // esattamente come 090000/110000 senza suffisso "Z" (che indicherebbe una conversione UTC).
    expect(result).toContain("DTSTART:20260901T090000\r\n");
    expect(result).toContain("DTEND:20260901T110000\r\n");
  });
});
