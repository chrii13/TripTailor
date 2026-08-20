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
