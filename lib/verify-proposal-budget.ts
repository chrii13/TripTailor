import type { TripProposal } from "./discover-trips-schema";
import { roundProposalCosts } from "./round-proposal-costs";

// Sotto questa cifra a persona a notte, la proposta non descrive un viaggio reale
// (vitto + alloggio): il modello sta reverse-ingegnerizzando i prezzi per obbedire al budget.
const MIN_PER_PERSON_PER_NIGHT = 25;

export function computeProposalTotal(proposal: TripProposal): number {
  const { travelTotal, lodgingTotal, onSiteTotal } = proposal.costs;
  return travelTotal + lodgingTotal + onSiteTotal;
}

export function verifyProposalsAgainstBudget(
  proposals: TripProposal[],
  budget: number,
  travelerCount: number,
  nights: number
): TripProposal[] {
  const plausibilityThreshold = MIN_PER_PERSON_PER_NIGHT * travelerCount * Math.max(nights, 1);

  return proposals
    .map((proposal) => ({ proposal, total: computeProposalTotal(proposal) }))
    .filter(({ total }) => total <= budget)
    // La card mostra le voci arrotondate e ne somma il totale: l'arrotondamento per
    // eccesso può portare oltre il budget una proposta che come cifre grezze ci sta
    // (375+325+275 = 975€ diventano 400+350+300 = 1050€). Il vincolo vale su ciò che
    // l'utente vede, quindi si verifica anche il totale arrotondato.
    .filter(({ proposal }) => roundProposalCosts(proposal.costs).total <= budget)
    .filter(
      ({ proposal }) =>
        proposal.costs.lodgingTotal + proposal.costs.onSiteTotal >= plausibilityThreshold
    )
    .sort((a, b) => a.total - b.total)
    .map(({ proposal, total }) => ({
      ...proposal,
      costs: { ...proposal.costs, total },
    }));
}
