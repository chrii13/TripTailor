import { z } from "zod";

export const activityDetailsSchema = z.object({
  about: z.string(),
  gettingThere: z.string(),
  tips: z.string(),
});

export const activitySchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
  openingHours: z.string().optional(),
  // Il prompt chiede "HH:MM–HH:MM", ma il modello alterna i tre trattini (ASCII, en dash,
  // em dash) e a volte lascia spazi attorno o ai bordi: li accettiamo tutti (e l'ora a una
  // cifra) e scartiamo il resto, perché l'export calendario spezza su questo formato.
  // La risposta è validata in blocco e un fallimento è un 502 senza ritentativo: essere
  // severi qui su un carattere costerebbe l'intera generazione.
  suggestedTime: z
    .string()
    .regex(/^\s*([01]?\d|2[0-3]):[0-5]\d\s*[-–—]\s*([01]?\d|2[0-3]):[0-5]\d\s*$/),
  details: activityDetailsSchema,
});

export const itineraryDaySchema = z.object({
  date: z.iso.date(),
  mattina: z.array(activitySchema),
  pomeriggio: z.array(activitySchema),
  sera: z.array(activitySchema),
});

export const itineraryResponseSchema = z.object({
  days: z.array(itineraryDaySchema),
});

export type ActivityDetails = z.infer<typeof activityDetailsSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
