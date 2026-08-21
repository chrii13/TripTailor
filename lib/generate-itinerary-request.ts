import { z } from "zod";
import { calendarDateSchema } from "./calendar-date";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// I due controlli sull'intervallo stanno dietro a .pipe() e non attaccati all'oggetto:
// in zod v4 i refine di un oggetto girano anche quando un campo interno è stato scartato,
// e con una data malformata riceverebbero ancora la stringa grezza, facendo esplodere
// .getTime() (500 invece del 400 dovuto). Dopo il pipe le date sono per forza Date vere.
const dateRangeSchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
  })
  .pipe(
    z
      .object({ from: z.date(), to: z.date() })
      .refine((range) => range.to >= range.from, {
        message: "La data di fine deve essere successiva o uguale alla data di inizio",
      })
      .refine(
        (range) => {
          const days = Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY) + 1;
          return days <= MAX_TRIP_DAYS;
        },
        { message: `Il viaggio non può superare i ${MAX_TRIP_DAYS} giorni` }
      )
  );

export const generateItineraryRequestSchema = z.object({
  destination: z.string().trim().min(1).max(200),
  dateRange: dateRangeSchema,
  participants: z.array(participantSchema).min(1).max(20),
  budget: z.number().min(0).max(1_000_000),
  styleNotes: z.string().max(1000).optional(),
  mustSee: z.string().max(200).optional(),
  arrivalTime: z.string().max(5).optional(),
  departureTime: z.string().max(5).optional(),
});

export type GenerateItineraryRequest = z.infer<typeof generateItineraryRequestSchema>;
