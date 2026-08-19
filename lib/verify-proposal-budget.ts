import type { TripProposal } from "./discover-trips-schema";

// Sotto questa cifra a persona a notte, la proposta non descrive un viaggio reale
// (vitto + alloggio): il modello sta reverse-ingegnerizzando i prezzi per obbedire al budget.
const MIN_PER_PERSON_PER_NIGHT = 25;

export function computeProposalTotal(proposal: TripProposal): number {
  const { flightsTotal, lodgingTotal, onSiteTotal } = proposal.costs;
  return flightsTotal + lodgingTotal + onSiteTotal;
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
