import { differenceInCalendarDays, parseISO } from "date-fns";
import { earliestRequestableDate, toCalendarDate } from "./calendar-date";
import type { TripProposal } from "./discover-trips-schema";

type FlexiblePeriod = { month: string; nights: number };

function isInMonth(isoDate: string, month: string): boolean {
  return isoDate.startsWith(month);
}

function isWindowConsistent(proposal: TripProposal, period: FlexiblePeriod): boolean {
  const { suggestedFrom, suggestedTo } = proposal;
  if (!suggestedFrom || !suggestedTo) return false;
  if (!isInMonth(suggestedFrom, period.month) || !isInMonth(suggestedTo, period.month)) return false;
  // Stare nel mese richiesto non basta: col mese corrente scelto a fine mese, tutte le
  // finestre dentro il mese possono essere già trascorse. Il confronto è fra stringhe
  // "yyyy-MM-dd", quindi senza fusi di mezzo; la soglia porta con sé la tolleranza di un
  // giorno che separa l'UTC del server dal fuso di chi ha fatto la richiesta.
  if (suggestedFrom < toCalendarDate(earliestRequestableDate())) return false;

  const nights = differenceInCalendarDays(parseISO(suggestedTo), parseISO(suggestedFrom));
  return nights === period.nights;
}

/**
 * Il modello sceglie la finestra di date in modalità "periodo flessibile", ma le sue date sono
 * inattendibili quanto la sua aritmetica dei costi: scarta ogni proposta la cui finestra non sta
 * dentro il mese richiesto o non dura esattamente il numero di notti richiesto.
 *
 * In modalità date esatte (nessun periodo flessibile) le proposte non hanno suggestedFrom/suggestedTo
 * e passano invariate.
 */
export function verifyProposalsAgainstSuggestedWindow(
  proposals: TripProposal[],
  flexiblePeriod: FlexiblePeriod | undefined
): TripProposal[] {
  if (!flexiblePeriod) return proposals;
  return proposals.filter((proposal) => isWindowConsistent(proposal, flexiblePeriod));
}
