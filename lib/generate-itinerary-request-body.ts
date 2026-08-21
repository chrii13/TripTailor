import { toCalendarDate } from "./calendar-date";
import type { TripFormValues } from "./schema";

/**
 * Costruisce il corpo della richiesta a /api/generate-itinerary a partire dai valori del form.
 * Serve solo a trasmettere le date come stringhe "yyyy-MM-dd" invece che come oggetti Date,
 * che JSON.stringify convertirebbe in istanti UTC facendo slittare il giorno lato server
 * (vedi calendar-date.ts). Il resto dei campi passa invariato.
 */
export function buildGenerateItineraryRequestBody(values: TripFormValues) {
  return {
    ...values,
    dateRange: {
      from: values.dateRange.from && toCalendarDate(values.dateRange.from),
      to: values.dateRange.to && toCalendarDate(values.dateRange.to),
    },
  };
}
