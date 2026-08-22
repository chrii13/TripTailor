import { differenceInCalendarDays, format, parse } from "date-fns";
import { it } from "date-fns/locale";

export type DiscoverRecapInput = {
  dateMode: "esatte" | "flessibili";
  dateRange: { from?: Date; to?: Date };
  flexiblePeriod: { month?: string; nights?: number };
};

/** Notti della ricerca, sia in modalità date esatte sia in modalità periodo flessibile. */
export function getSearchNights(input: DiscoverRecapInput): number {
  if (input.dateMode === "flessibili") {
    return input.flexiblePeriod.nights ?? 0;
  }
  if (!input.dateRange.from || !input.dateRange.to) return 0;
  return Math.max(differenceInCalendarDays(input.dateRange.to, input.dateRange.from), 0);
}

function formatMonthLabel(month: string): string {
  const date = parse(month, "yyyy-MM", new Date());
  return format(date, "LLLL yyyy", { locale: it });
}

/**
 * Descrizione testuale del periodo cercato per la striscia di riepilogo dei risultati:
 * un intervallo di date in modalità esatte, mese e numero di notti in modalità flessibile.
 * Non deve mai mostrare un intervallo di date quando la ricerca era flessibile (il mese non
 * si traduce in date precise), né un mese quando la ricerca era a date esatte.
 */
export function formatSearchPeriod(input: DiscoverRecapInput): string {
  if (input.dateMode === "flessibili") {
    if (!input.flexiblePeriod.month || input.flexiblePeriod.nights === undefined) {
      return "periodo da confermare";
    }
    const nights = input.flexiblePeriod.nights;
    return `${formatMonthLabel(input.flexiblePeriod.month)} · ${nights} ${nights === 1 ? "notte" : "notti"}`;
  }

  if (!input.dateRange.from || !input.dateRange.to) return "date da confermare";
  const nights = getSearchNights(input);
  if (nights === 0) return `${format(input.dateRange.from, "dd MMM", { locale: it })} (in giornata)`;
  return `${format(input.dateRange.from, "dd MMM", { locale: it })} - ${format(input.dateRange.to, "dd MMM", { locale: it })}`;
}
