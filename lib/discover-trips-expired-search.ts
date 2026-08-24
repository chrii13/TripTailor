import { isFlexibleMonthPast } from "./discover-trips-flexible-period";
import type { DiscoverRecapInput } from "./discover-trips-recap";

/**
 * Le proposte di /scopri restano in sessionStorage, così tornando indietro dalla
 * pagina di una proposta non si perde nulla. Ma la ricerca che le ha prodotte ha
 * una scadenza: se le sue date sono nel frattempo passate, il ripristino le
 * rimetterebbe nel form e l'errore comparirebbe solo al reinvio, cioè quando
 * l'utente non ha toccato niente e non può capire cosa sia cambiato.
 *
 * Guarda solo il periodo che la ricerca ha davvero usato: in modalità flessibile
 * il form può conservare un `dateRange` mai inviato, e viceversa.
 * `today` è la mezzanotte locale (`startOfToday()`): qui siamo dalla parte del
 * browser, dove il fuso è quello dell'utente e non serve la tolleranza di un
 * giorno che il server applica per coprire i fusi.
 */
export function isDiscoverSearchExpired(input: DiscoverRecapInput, today: Date): boolean {
  if (input.dateMode === "flessibili") {
    const month = input.flexiblePeriod.month;
    return month !== undefined && isFlexibleMonthPast(month, today);
  }
  const from = input.dateRange.from;
  return from !== undefined && from < today;
}

/**
 * Toglie dalla ricerca ripristinata un mese ormai passato, prima di rimetterla
 * nel form. Il menu offre solo i mesi da quello in corso in poi, e Radix con un
 * valore che non corrisponde a nessuna voce non rende nulla — nemmeno il
 * segnaposto: il campo resterebbe visivamente vuoto mentre l'errore parla di
 * «un mese già passato», cioè di una scelta che l'utente non vede da nessuna
 * parte. Azzerandolo, il segnaposto «Scegli il mese» e il messaggio «Seleziona
 * un mese» dicono la stessa cosa. Le date della ricerca restano intatte nella
 * striscia di riepilogo dei risultati, che continua a mostrare cosa era stato
 * cercato: qui si tocca solo lo stato del form.
 */
export function clearExpiredFlexibleMonth<T extends DiscoverRecapInput>(input: T, today: Date): T {
  if (input.dateMode !== "flessibili") return input;
  const month = input.flexiblePeriod.month;
  if (month === undefined || !isFlexibleMonthPast(month, today)) return input;
  return { ...input, flexiblePeriod: { ...input.flexiblePeriod, month: undefined } };
}
