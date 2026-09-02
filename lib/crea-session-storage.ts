import { z } from "zod";

import {
  MAX_DESTINATION_LENGTH,
  MAX_MUST_SEE_LENGTH,
  MAX_STYLE_NOTES_LENGTH,
  participantSchema,
  type TripFormValues,
} from "./schema";
import { itineraryResponseSchema, type ItineraryResponse } from "./itinerary-schema";
import { calendarDateSchema, toCalendarDate } from "./calendar-date";
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

// Le date del viaggio restano date di *calendario* anche qui dentro, cioè stringhe
// "yyyy-MM-dd" ricostruite come mezzanotte locale: la regola di lib/calendar-date.ts
// vale su questo filo come su quello verso il server. Sembrerebbe superfluo — il
// valore non lascia mai il dispositivo, e un `Date` serializzato in UTC tornerebbe
// identico purché il fuso non cambi. Ma questa è un'app di viaggi: un portatile che
// atterra in un altro fuso e ricarica la pagina cambia il fuso **a scheda aperta**,
// e allora l'istante sopravvive mentre il giorno di calendario reso slitta — lo
// stesso difetto del 2026-08-21, in casa nostra. L'assunzione "stesso fuso" non
// regge proprio nel dominio di quest'app.
//
// Le due date sono obbligatorie e non opzionali: un itinerario senza date non esiste,
// e ripristinare un risultato con il periodo mancante darebbe una pagina monca invece
// del form vuoto. È lo stesso motivo del .refine sul periodo in discover-form.tsx.
const storedDateRangeSchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
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

// Più severo di accettaConsigli in itinerary-result.tsx, che si limita ai tre campi
// resi come figli JSX diretti (date, name, comment) perché deve accettare quel che la
// route manda davvero, campi facoltativi compresi. Qui invece il contenuto lo abbiamo
// scritto noi, e sappiamo esattamente com'era: pretendere anche i campi che la resa
// stringifica costa nulla, e uno che non torna vuol dire che quel valore non è nostro.
// La severità non è un rischio proprio perché il campo è isolato (vedi il .catch(null)
// qui sotto): quel che non torna toglie di mezzo la cena, non la sessione.
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
  // Il guasto si isola sul campo meno importante: la cena si rigenera in otto secondi,
  // l'itinerario costa trenta secondi di Gemini e non deve cadere per colpa sua. Senza
  // il .catch il campo più fragile della sessione butterebbe via il più prezioso.
  dinner: storedDinnerSchema.nullable().catch(null),
});

export function saveCreaSession(session: CreaSession): void {
  const { from, to } = session.submitted.dateRange;
  // Senza le date non c'è un itinerario da riprendere: si evita di scrivere una
  // sessione che la rilettura scarterebbe comunque.
  if (!from || !to) return;

  try {
    const payload = {
      ...session,
      submitted: {
        ...session.submitted,
        dateRange: { from: toCalendarDate(from), to: toCalendarDate(to) },
      },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
