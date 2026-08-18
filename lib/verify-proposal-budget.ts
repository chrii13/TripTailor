import type { TripProposal } from "./discover-trips-schema";

export function computeProposalTotal(proposal: TripProposal): number {
  const { flightsTotal, lodgingTotal, onSiteTotal } = proposal.costs;
  return flightsTotal + lodgingTotal + onSiteTotal;
}

export function verifyProposalsAgainstBudget(
  proposals: TripProposal[],
  budget: number
): TripProposal[] {
  return proposals
    .map((proposal) => ({ proposal, total: computeProposalTotal(proposal) }))
    .filter(({ total }) => total <= budget)
    .sort((a, b) => a.total - b.total)
    .map(({ proposal, total }) => ({
      ...proposal,
      costs: { ...proposal.costs, total },
    }));
}
