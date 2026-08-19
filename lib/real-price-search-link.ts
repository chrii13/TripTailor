import { format } from "date-fns";
import { it } from "date-fns/locale";

// Link "verifica i prezzi reali" sulle proposte di /scopri: una ricerca Google
// semplice (non Google Flights) con quello che una persona digiterebbe da
// sola. Deliberatamente NON assume un mezzo di trasporto — le proposte
// arrivano prezzate anche come treno o traghetto, non solo aereo — quindi la
// query resta generica ("viaggio", non "volo").
//
// `departureCity` arriva dall'autocompletamento destinazione nel formato
// "Città, Paese" (o, quando LocationIQ non ha un display_place pulito, da una
// stringa amministrativa lunga tipo "Città Metropolitana di Roma Capitale,
// Lazio, Italia"): se ne tiene solo il primo segmento, la città vera e
// propria, così la query resta quella che una persona digiterebbe.
function firstSegment(value: string): string {
  return value.split(",")[0].trim();
}

export function buildRealPriceSearchQuery(
  departureCity: string,
  destination: string,
  departureDate: Date,
  destinationCountry?: string
): string {
  const dateLabel = format(departureDate, "d MMMM yyyy", { locale: it });
  const city = firstSegment(departureCity);
  const destinationLabel = destinationCountry
    ? `${destination} ${destinationCountry}`
    : destination;
  return `viaggio ${city} ${destinationLabel} ${dateLabel}`;
}

export function buildRealPriceSearchUrl(
  departureCity: string,
  destination: string,
  departureDate: Date,
  destinationCountry?: string
): string {
  const query = buildRealPriceSearchQuery(departureCity, destination, departureDate, destinationCountry);
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
