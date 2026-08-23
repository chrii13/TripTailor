import { z } from "zod";
import { startOfToday } from "./calendar-date";

// Limiti dei campi di testo: stessi numeri per lo schema del form e per quello
// della richiesta, così l'utente li vede nell'interfaccia invece di ricevere un
// 400 su un errore che non potrebbe capire.
export const MAX_DESTINATION_LENGTH = 200;
export const MAX_STYLE_NOTES_LENGTH = 1000;
export const MAX_MUST_SEE_LENGTH = 200;

export const AGE_RANGES = {
  bambino: { min: 0, max: 12 },
  ragazzo: { min: 13, max: 25 },
  adulto: { min: 26, max: 100 },
} as const;

export const MAX_TRIP_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ParticipantType = keyof typeof AGE_RANGES;

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino/a",
  ragazzo: "Ragazzo/a",
  adulto: "Adulto/a",
};

export const participantSchema = z
  .object({
    type: z.enum(["bambino", "ragazzo", "adulto"]),
    age: z.number().int().optional(),
  })
  .refine((participant) => participant.age !== undefined, {
    message: "Seleziona un'età",
    path: ["age"],
  })
  .refine(
    (participant) => {
      if (participant.age === undefined) return true;
      const range = AGE_RANGES[participant.type];
      return participant.age >= range.min && participant.age <= range.max;
    },
    { message: "Età non valida per il tipo selezionato", path: ["age"] }
  );

export const tripFormSchema = z.object({
  destination: z
    .string()
    .trim()
    .min(1, "Inserisci una destinazione")
    .max(MAX_DESTINATION_LENGTH, `Massimo ${MAX_DESTINATION_LENGTH} caratteri`),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .refine((range) => !!range.from && !!range.to, {
      message: "Seleziona le date di inizio e fine",
    })
    .refine((range) => !range.from || range.from >= startOfToday(), {
      message: "Le date del viaggio non possono essere nel passato",
    })
    .refine((range) => !range.from || !range.to || range.to >= range.from, {
      message: "La data di fine deve essere successiva o uguale alla data di inizio",
    })
    .refine(
      (range) => {
        if (!range.from || !range.to) return true;
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
  participants: z.array(participantSchema).min(1, "Aggiungi almeno un partecipante").max(20, "Massimo 20 partecipanti"),
  budget: z.number().min(0),
  styleNotes: z.string().max(MAX_STYLE_NOTES_LENGTH, `Massimo ${MAX_STYLE_NOTES_LENGTH} caratteri`).optional(),
  mustSee: z.string().max(MAX_MUST_SEE_LENGTH, `Massimo ${MAX_MUST_SEE_LENGTH} caratteri`).optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
});

export type TripFormValues = z.infer<typeof tripFormSchema>;
export type Participant = z.infer<typeof participantSchema>;
