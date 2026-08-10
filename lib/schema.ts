import { z } from "zod";

export const AGE_RANGES = {
  bambino: { min: 0, max: 12, default: 5 },
  ragazzo: { min: 13, max: 25, default: 18 },
  adulto: { min: 26, max: 100, default: 30 },
} as const;

export type ParticipantType = keyof typeof AGE_RANGES;

export const participantSchema = z
  .object({
    type: z.enum(["bambino", "ragazzo", "adulto"]),
    age: z.number().int(),
  })
  .refine(
    (participant) => {
      const range = AGE_RANGES[participant.type];
      return participant.age >= range.min && participant.age <= range.max;
    },
    { message: "Età non valida per il tipo selezionato", path: ["age"] }
  );

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
