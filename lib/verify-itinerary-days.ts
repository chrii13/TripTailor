import { addDays, differenceInCalendarDays } from "date-fns";
import { toCalendarDate } from "./calendar-date";

/**
 * Lo schema controlla la forma dell'itinerario, non il senso: `days` può contenere date
 * ben formate ma sbagliate — tre giorni per un viaggio di dieci, il giorno di partenza
 * ripetuto due volte, un 1999 al posto del 2026. È la stessa diffidenza verso il modello
 * che `verify-proposal-budget` e `verify-suggested-window` applicano alla ricerca inversa:
 * qui però non si scarta il singolo giorno, perché un itinerario a cui manca un giorno non
 * è un itinerario più corto, è un itinerario sbagliato — o torna tutto o si ritenta.
 *
 * Il confronto è fra stringhe "yyyy-MM-dd" costruite con `toCalendarDate`, mai fra oggetti
 * `Date` nati da stringhe: le date del viaggio sono date di calendario e il server gira in
 * UTC mentre l'utente sceglie nel proprio fuso. `addDays` avanza di un giorno di calendario
 * (non di 24 ore), quindi il giorno del cambio d'ora non fa slittare la sequenza.
 *
 * Il confronto posizionale copre in un colpo solo tutto ciò che serve: numero di giorni
 * esatto, nessun duplicato, nessun buco, ordine crescente.
 */
export function verifyItineraryDays(days: { date: string }[], from: Date, to: Date): boolean {
  const span = differenceInCalendarDays(to, from);
  if (span < 0) return false;
  if (days.length !== span + 1) return false;

  return days.every((day, index) => day.date === toCalendarDate(addDays(from, index)));
}
