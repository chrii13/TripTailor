import { addMonths, format, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";

export type MonthOption = { value: string; label: string };

/**
 * Elenco dei mesi selezionabili per la modalità "periodo flessibile" di /scopri:
 * dal mese corrente ai dodici mesi successivi, valore in formato YYYY-MM ed
 * etichetta in italiano (es. "ottobre 2026").
 */
export function buildFlexibleMonthOptions(now: Date): MonthOption[] {
  const options: MonthOption[] = [];
  for (let i = 0; i <= 12; i++) {
    const date = addMonths(startOfMonth(now), i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: it }),
    });
  }
  return options;
}
