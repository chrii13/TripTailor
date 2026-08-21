import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";
import { calendarDateSchema } from "./calendar-date";
import { participantSchema, MAX_TRIP_DAYS } from "./schema";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Un soggiorno di N notti copre N+1 giorni: il tetto di MAX_TRIP_DAYS giorni
// diventa quindi MAX_TRIP_DAYS - 1 notti.
export const MAX_TRIP_NIGHTS = MAX_TRIP_DAYS - 1;

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

// I due controlli sull'intervallo stanno dietro a .pipe() e non attaccati all'oggetto:
// in zod v4 i refine di un oggetto girano anche quando un campo interno è stato scartato,
// e con una data malformata riceverebbero ancora la stringa grezza, facendo esplodere
// .getTime() (500 invece del 400 dovuto). Dopo il pipe le date sono per forza Date vere.
const exactDateRangeSchema = z
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

const flexiblePeriodSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mese non valido, usa il formato YYYY-MM"),
  nights: z
    .number()
    .int()
    .min(1)
    .max(MAX_TRIP_NIGHTS, { message: `Il soggiorno non può superare le ${MAX_TRIP_NIGHTS} notti` }),
});

export const discoverTripsRequestSchema = z
  .object({
    departureCity: z.string().trim().min(1).max(200),
    dateRange: exactDateRangeSchema.optional(),
    flexiblePeriod: flexiblePeriodSchema.optional(),
    participants: z.array(participantSchema).min(1).max(20),
    budget: z.number().min(0).max(1_000_000),
    vacationType: z.string().trim().max(100).optional(),
  })
  .refine((data) => (data.dateRange !== undefined) !== (data.flexiblePeriod !== undefined), {
    message: "Specifica date esatte oppure un periodo flessibile, non entrambi né nessuno dei due",
    path: ["dateRange"],
  });

export type DiscoverTripsRequest = z.infer<typeof discoverTripsRequestSchema>;

/** Numero di notti del viaggio, sia in modalità date esatte sia in modalità periodo flessibile. */
export function getRequestNights(request: DiscoverTripsRequest): number {
  if (request.flexiblePeriod) {
    return request.flexiblePeriod.nights;
  }
  return differenceInCalendarDays(request.dateRange!.to, request.dateRange!.from);
}
