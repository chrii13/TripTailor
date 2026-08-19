import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { TripProposal } from "./discover-trips-schema";

/**
 * Etichetta in italiano della finestra di date suggerita dal modello per una proposta in
 * modalità periodo flessibile (es. "10 - 17 ott"). Restituisce null quando la proposta non
 * ne ha una (modalità date esatte, dove i campi non sono nemmeno presenti dopo item 0).
 */
export function formatSuggestedWindowLabel(proposal: TripProposal): string | null {
  if (!proposal.suggestedFrom || !proposal.suggestedTo) return null;
  const from = parseISO(proposal.suggestedFrom);
  const to = parseISO(proposal.suggestedTo);
  return `${format(from, "d MMM", { locale: it })} - ${format(to, "d MMM", { locale: it })}`;
}
