import { z } from "zod";

export const activitySchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
  openingHours: z.string().optional(),
});

export const itineraryDaySchema = z.object({
  date: z.string(),
  mattina: z.array(activitySchema),
  pomeriggio: z.array(activitySchema),
  sera: z.array(activitySchema),
});

export const itineraryResponseSchema = z.object({
  days: z.array(itineraryDaySchema),
});

export type Activity = z.infer<typeof activitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type ItineraryResponse = z.infer<typeof itineraryResponseSchema>;
