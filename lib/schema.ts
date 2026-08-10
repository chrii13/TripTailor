import { z } from "zod";

export const participantSchema = z.object({
  type: z.enum(["adulto", "bambino"]),
  age: z.number().int().min(0, "L'età non può essere negativa"),
});

export const tripFormSchema = z.object({
  destination: z.string().trim().min(1, "Inserisci una destinazione"),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .refine((range) => !!range.from && !!range.to, {
      message: "Seleziona le date di inizio e fine",
    })
    .refine((range) => !range.from || !range.to || range.to >= range.from, {
      message: "La data di fine deve essere successiva o uguale alla data di inizio",
    }),
  participants: z.array(participantSchema).min(1, "Aggiungi almeno un partecipante"),
  budget: z.number().min(0),
  styleNotes: z.string().optional(),
});

export type TripFormValues = z.infer<typeof tripFormSchema>;
export type Participant = z.infer<typeof participantSchema>;
