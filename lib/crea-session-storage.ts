import { z } from "zod";

import {
  MAX_DESTINATION_LENGTH,
  MAX_MUST_SEE_LENGTH,
  MAX_STYLE_NOTES_LENGTH,
  participantSchema,
  type TripFormValues,
} from "./schema";
import { itineraryResponseSchema, type ItineraryResponse } from "./itinerary-schema";
import type { DailyClimateAverage } from "./climate-forecast";
import type { CountryInfo } from "./country-info";
// Solo il tipo, cancellato in compilazione: la forma del consiglio è quella che la
// route restituisce davvero, non una copia che può divergerne.
import type { DinnerSuggestion } from "@/app/api/dinner-suggestions/route";

// Un itinerario costa venti-trenta secondi, quota Gemini e — con i consigli sulla
// cena — una seconda chiamata di rete: un ricaricamento o il tasto indietro non
// devono buttarlo via, tanto più che rigenerarlo produce un itinerario *diverso*.
// sessionStorage (non localStorage) perché il risultato appartiene a questa
// sessione di navigazione, non deve ricomparire giorni dopo come se fosse attuale.
// È la stessa scelta già fatta per le proposte di /scopri.
const STORAGE_KEY = "crea-itinerary-session";

export interface CreaSession {
  /** Il modo in cui era la pagina: chi preme «Modifica» e poi ricarica non deve
   *  ritrovarsi sbattuto sul risultato che aveva appena lasciato. */
  mode: "form" | "result";
  submitted: TripFormValues;
  itinerary: ItineraryResponse;
  weather: DailyClimateAverage[] | null;
  countryInfo: CountryInfo | null;
  dinner: DinnerSuggestion[] | null;
}

// Le date del form sono oggetti Date e JSON.stringify le serializza in UTC
// ("...T22:00:00Z" per una mezzanotte italiana). Qui **non** slitta niente, ed è
// il motivo per cui questa è l'unica deroga alla regola del "solo yyyy-MM-dd sul
// filo" scritta in CLAUDE.md: quella regola esiste perché il *server* rilegge in
// UTC ciò che il *browser* ha scritto nel proprio fuso, mentre questo valore non
// lascia mai il dispositivo — lo rileggiamo noi, nello stesso fuso, e l'istante
// torna identico. È anche ciò che /scopri già fa con le sue proposte.
const storedDateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// La forma va validata, non dedotta con un cast: sessionStorage è scrivibile da
// chiunque, e un valore malformato che passasse indenne finirebbe per far lanciare
// la resa, mandando /crea in error boundary invece che al form vuoto. È già
// successo su /scopri. Qui uno scarto vale "riparti dal form vuoto", in silenzio.
const storedSubmittedSchema = z.object({
  destination: z.string().trim().min(1).max(MAX_DESTINATION_LENGTH),
  dateRange: storedDateRangeSchema,
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0),
  styleNotes: z.string().max(MAX_STYLE_NOTES_LENGTH).optional(),
  mustSee: z.string().max(MAX_MUST_SEE_LENGTH).optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
});

const storedWeatherSchema = z.array(
  z.object({
    date: z.string(),
    tempMaxAvg: z.number(),
    tempMinAvg: z.number(),
    precipitationChance: z.number(),
  })
);

const storedCountryInfoSchema = z.object({
  name: z.string(),
  code: z.string(),
  currency: z.object({ code: z.string(), symbol: z.string(), name: z.string() }),
  languages: z.array(z.string()),
  timezones: z.array(z.string()),
});

// Gli stessi campi che il client controlla su ciò che arriva dalla route (vedi
// accettaConsigli in itinerary-result.tsx): quelli resi come figli JSX diretti
// devono esserci ed essere stringhe, o la resa lancia.
const storedDinnerSchema = z.array(
  z.object({
    date: z.string(),
    name: z.string(),
    comment: z.string(),
    distanceMeters: z.number(),
    lat: z.number(),
    lon: z.number(),
    street: z.string().optional(),
    openingHours: z.string().optional(),
  })
);

const storedSessionSchema = z.object({
  mode: z.enum(["form", "result"]),
  submitted: storedSubmittedSchema,
  itinerary: itineraryResponseSchema,
  weather: storedWeatherSchema.nullable(),
  countryInfo: storedCountryInfoSchema.nullable(),
  dinner: storedDinnerSchema.nullable(),
});

export function saveCreaSession(session: CreaSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage non disponibile (es. navigazione privata): non blocca il flusso
  }
}

export function loadCreaSession(): CreaSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = storedSessionSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    // valore corrotto o non leggibile: si riparte dal form vuoto senza errori
    return null;
  }
}
