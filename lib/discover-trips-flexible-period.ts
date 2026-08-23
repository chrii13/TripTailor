import { addMonths, format, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";

export type MonthOption = { value: string; label: string };

/**
 * In italiano i mesi vanno minuscoli dentro una frase, ma qui sono etichette di
 * una voce di menu — cioè nomi di opzioni, non parole in un discorso — e
 * l'iniziale maiuscola è quello che ci si aspetta di leggere in un elenco.
 * date-fns restituisce sempre minuscolo, quindi la maiuscola va messa a mano.
 */
function conInizialeMaiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/**
 * Elenco dei mesi selezionabili per la modalità "periodo flessibile" di /scopri:
 * dal mese corrente ai dodici mesi successivi, valore in formato YYYY-MM ed
 * etichetta in italiano (es. "Ottobre 2026").
 */
export function buildFlexibleMonthOptions(now: Date): MonthOption[] {
  const options: MonthOption[] = [];
  for (let i = 0; i <= 12; i++) {
    const date = addMonths(startOfMonth(now), i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: conInizialeMaiuscola(format(date, "LLLL yyyy", { locale: it })),
    });
  }
  return options;
}

/**
 * Un mese è passato quando è finito del tutto, cioè quando è precedente al mese
 * in cui si trova `today`. Serve perché l'elenco qui sopra viene costruito una
 * volta sola: una pagina lasciata aperta a cavallo della mezzanotte dell'ultimo
 * giorno del mese continua a offrire il mese vecchio, e il server lo accetta
 * (la sua soglia è "ieri", per coprire i fusi) sprecando una chiamata al modello
 * per arrivare allo stato vuoto. Il confronto è fra stringhe "yyyy-MM", che si
 * ordinano già cronologicamente, quindi non c'è nessuna data da ricostruire.
 */
export function isFlexibleMonthPast(month: string, today: Date): boolean {
  return month < format(today, "yyyy-MM");
}

/**
 * Un valore di mese ha la forma prodotta dall'elenco qui sopra: "yyyy-MM", con
 * mese fra 01 e 12. Serve a rileggere sessionStorage, dove il valore può essere
 * qualsiasi cosa: un mese malformato attraverserebbe indenne il confronto fra
 * stringhe di `isFlexibleMonthPast` per poi far lanciare `formatMonthLabel`
 * (`lib/discover-trips-recap.ts`, `format()` su una data non valida) e mandare
 * l'intera pagina nell'error boundary. Un dato corrotto deve far scartare la
 * ricerca salvata, non far sparire il form.
 */
export function isFlexibleMonthValue(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
