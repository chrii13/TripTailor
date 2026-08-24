import type { ItineraryDay } from "./itinerary-schema";

/**
 * La tappa che dice dove si trova l'utente all'ora di cena. È l'ultima del pomeriggio
 * perché la sera si mangia dove il pomeriggio è finito; se il pomeriggio è vuoto vale la
 * prima della sera. Senza nessuna delle due non c'è un punto attorno a cui cercare, e un
 * consiglio "vicino" a niente non è un consiglio.
 */
export function pickDinnerAnchor(day: ItineraryDay): string | null {
  const pomeriggio = day.pomeriggio.at(-1);
  if (pomeriggio) return pomeriggio.title;

  const sera = day.sera.at(0);
  if (sera) return sera.title;

  return null;
}
