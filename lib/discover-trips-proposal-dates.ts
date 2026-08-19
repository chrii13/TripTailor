import { parseISO } from "date-fns";
import type { TripProposal } from "./discover-trips-schema";

/**
 * Date da passare a buildCreaHref per una proposta: in modalità esatte le date scelte
 * dall'utente, come oggi. In modalità flessibile SOLO la finestra suggerita dal modello
 * (suggestedFrom/suggestedTo) — mai una data calcolata localmente, perché l'intera ragion
 * d'essere del periodo flessibile è che è il modello a scegliere quando andare. Se una
 * proposta non ha una finestra utilizzabile si omettono le date dal link piuttosto che
 * inventarle.
 */
export function resolveProposalDates(
  proposal: TripProposal,
  dateMode: "esatte" | "flessibili",
  exactRange: { from?: Date; to?: Date }
): { from?: Date; to?: Date } {
  if (dateMode === "flessibili") {
    if (proposal.suggestedFrom && proposal.suggestedTo) {
      return { from: parseISO(proposal.suggestedFrom), to: parseISO(proposal.suggestedTo) };
    }
    return {};
  }
  return exactRange;
}
