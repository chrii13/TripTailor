import { z } from "zod";

// Il numero che il prompt cita al modello: la misura su cui è pensato il commento sotto
// il consiglio della sera.
export const MAX_DINNER_COMMENT_LENGTH = 220;

// La misura che lo schema pretende davvero, ed è di proposito più larga di quella
// chiesta. Qui una risposta contiene TUTTE le sere del viaggio: convalidare a 220 spaccati
// significa che un commento di 221 caratteri fa fallire il safeParse dell'intera risposta
// e lascia senza consiglio anche le altre giornate, per un carattere di troppo in una
// sola. La tolleranza lascia passare lo sforamento breve — un fastidio estetico — e ferma
// solo il commento che è diventato un paragrafo. Stessa ragione di
// MAX_ACTIVITY_TITLE_LENGTH in lib/itinerary-schema.ts (60 nello schema, 40 nel prompt):
// i due numeri divergono apposta, non vanno "riallineati".
export const MAX_DINNER_COMMENT_TOLERANCE = 300;

export const dinnerSuggestionsResponseSchema = z.object({
  // Nessun .max() sull'array: Gemini rifiuta `maxItems` nel responseJsonSchema (vedi
  // CLAUDE.md). Il numero di giornate è comunque quello che gli abbiamo dato, e le
  // giornate senza corrispondenza vengono ignorate a valle.
  days: z
    .array(
      z.object({
        date: z.iso.date(),
        chosenId: z.number().int(),
        comment: z.string().min(1).max(MAX_DINNER_COMMENT_TOLERANCE),
      })
    )
    .min(1),
});

export type DinnerSuggestionsResponse = z.infer<typeof dinnerSuggestionsResponseSchema>;
