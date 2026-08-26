import { z } from "zod";
import {
  participantSchema,
  MAX_DESTINATION_LENGTH,
  MAX_STYLE_NOTES_LENGTH,
  MAX_TRIP_DAYS,
} from "./schema";

export const dinnerSuggestionsRequestSchema = z.object({
  destination: z.string().trim().min(1).max(MAX_DESTINATION_LENGTH),
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0).max(1_000_000),
  styleNotes: z.string().max(MAX_STYLE_NOTES_LENGTH).optional(),
  days: z
    .array(
      z.object({
        // Qui la data resta una *stringa* di calendario e non passa da
        // `calendarDateSchema`, che la trasformerebbe in un oggetto Date: serve a
        // riconoscere la giornata dentro la risposta del modello, che la riporta come
        // stringa. La validazione del formato è comunque la stessa (`z.iso.date()`, ciò
        // che `calendarDateSchema` verifica prima di trasformare), quindi la regola sulle
        // date di calendario resta rispettata: sul filo passa solo "yyyy-MM-dd".
        date: z.iso.date(),
        anchorTitle: z.string().trim().min(1).max(200),
      })
    )
    // Lo stesso tetto del viaggio: le giornate arrivano da un itinerario già generato,
    // che non può superarlo. Qui il .max() è innocuo — questo schema valida la nostra
    // richiesta, non è lo schema di risposta inviato a Gemini (che rifiuta `maxItems`).
    .min(1)
    .max(MAX_TRIP_DAYS),
});

export type DinnerSuggestionsRequest = z.infer<typeof dinnerSuggestionsRequestSchema>;
