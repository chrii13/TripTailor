import { format } from "date-fns";
import { it } from "date-fns/locale";

// Link "verifica i prezzi reali" sulle proposte di /scopri: una ricerca Google
// semplice (non Google Flights) con quello che una persona digiterebbe da
// sola. Deliberatamente NON assume un mezzo di trasporto — le proposte
// arrivano prezzate anche come treno o traghetto, non solo aereo — quindi la
// query resta generica ("viaggio", non "volo").
export function buildRealPriceSearchQuery(
  departureCity: string,
  destination: string,
  departureDate: Date
): string {
  const dateLabel = format(departureDate, "d MMMM yyyy", { locale: it });
  return `viaggio ${departureCity} ${destination} ${dateLabel}`;
}

export function buildRealPriceSearchUrl(
  departureCity: string,
  destination: string,
  departureDate: Date
): string {
  const query = buildRealPriceSearchQuery(departureCity, destination, departureDate);
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
