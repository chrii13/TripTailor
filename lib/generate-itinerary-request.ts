import { z } from "zod";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const generateItineraryRequestSchema = z.object({
  destination: z.string().trim().min(1),
  dateRange: z
    .object({
      from: z.coerce.date(),
      to: z.coerce.date(),
    })
    .refine((range) => range.to >= range.from, {
      message: "La data di fine deve essere successiva o uguale alla data di inizio",
    })
    .refine(
      (range) => {
        const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
        return days <= MAX_TRIP_DAYS;
      },
      { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
    ),
  participants: z.array(participantSchema).min(1),
  budget: z.number().min(0),
  styleNotes: z.string().optional(),
});

export type GenerateItineraryRequest = z.infer<typeof generateItineraryRequestSchema>;
