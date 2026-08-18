import { z } from "zod";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const VACATION_TYPES = [
  "mare",
  "montagna",
  "citta-arte",
  "natura",
  "gastronomia",
  "relax",
] as const;

export type VacationType = (typeof VACATION_TYPES)[number];

export const VACATION_TYPE_LABELS: Record<VacationType, string> = {
  mare: "Mare",
  montagna: "Montagna",
  "citta-arte": "Città d'arte",
  natura: "Natura",
  gastronomia: "Gastronomia",
  relax: "Relax",
};

export const discoverTripsRequestSchema = z.object({
  departureCity: z.string().trim().min(1).max(200),
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
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0).max(1_000_000),
  vacationType: z.enum(VACATION_TYPES).optional(),
});

export type DiscoverTripsRequest = z.infer<typeof discoverTripsRequestSchema>;
