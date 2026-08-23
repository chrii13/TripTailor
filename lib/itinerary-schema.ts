import { z } from "zod";

// Il prompt chiede titoli da massimo 40 caratteri e la card è disegnata su quella misura,
// ma un titolo di 45 caratteri è un difetto estetico, non una risposta da buttare: la
// tolleranza lascia passare lo sforamento breve e ferma solo il paragrafo travestito da
// titolo, che il layout non reggerebbe.
export const MAX_ACTIVITY_TITLE_LENGTH = 60;

export const activityDetailsSchema = z.object({
  about: z.string(),
  gettingThere: z.string(),
  tips: z.string(),
});

export const activitySchema = z.object({
  title: z.string().min(1).max(MAX_ACTIVITY_TITLE_LENGTH),
  description: z.string(),
  estimatedCost: z.string(),
  openingHours: z.string().optional(),
  // Il prompt chiede "HH:MM–HH:MM", ma il modello alterna i tre trattini (ASCII, en dash,
  // em dash) e a volte lascia spazi attorno o ai bordi: li accettiamo tutti (e l'ora a una
  // cifra) e scartiamo il resto, perché l'export calendario spezza su questo formato.
  // La risposta è validata in blocco e un fallimento è un 502 senza ritentativo: essere
  // severi qui su un carattere costerebbe l'intera generazione.
  suggestedTime: z
    .string()
    .regex(/^\s*([01]?\d|2[0-3]):[0-5]\d\s*[-–—]\s*([01]?\d|2[0-3]):[0-5]\d\s*$/),
  details: activityDetailsSchema,
});

export const itineraryDaySchema = z.object({
  date: z.iso.date(),
  mattina: z.array(activitySchema),
  pomeriggio: z.array(activitySchema),
  sera: z.array(activitySchema),
});

export const itineraryResponseSchema = z.object({
  // Un itinerario senza giorni non è un itinerario: senza .min(1) il client riceverebbe
  // 200 OK e una pagina vuota.
  //
  // Nessun .max() qui, e non è un indebolimento: questo schema viene inviato a Gemini
  // come responseJsonSchema, che rifiuta con 400 INVALID_ARGUMENT il maxItems che
  // .max() emette (min(1) e i limiti di lunghezza sui titoli passano invece senza
  // problemi — vedi gemini-response-json-schema.test.ts). Il tetto sui giorni resta
  // comunque garantito da una catena di controlli: lo schema di richiesta rifiuta
  // intervalli oltre MAX_TRIP_DAYS giorni, e verifyItineraryDays impone che i giorni
  // restituiti coprano *esattamente* quell'intervallo — quindi non possono essere di
  // più. Il tetto è implicato dalla copertura esatta.
  days: z.array(itineraryDaySchema).min(1),
});

export type ActivityDetails = z.infer<typeof activityDetailsSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
