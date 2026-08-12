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
  suggestedTime: z.string(),
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
