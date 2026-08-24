import { z } from "zod";

export const MAX_DINNER_COMMENT_LENGTH = 220;

export const dinnerSuggestionsResponseSchema = z.object({
  // Nessun .max() sull'array: Gemini rifiuta `maxItems` nel responseJsonSchema (vedi
  // CLAUDE.md). Il numero di giornate è comunque quello che gli abbiamo dato, e le
  // giornate senza corrispondenza vengono ignorate a valle.
  days: z
    .array(
      z.object({
        date: z.iso.date(),
        chosenId: z.number().int(),
        comment: z.string().min(1).max(MAX_DINNER_COMMENT_LENGTH),
      })
    )
    .min(1),
});

export type DinnerSuggestionsResponse = z.infer<typeof dinnerSuggestionsResponseSchema>;
