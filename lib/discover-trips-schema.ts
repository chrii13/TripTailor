import { z } from "zod";

const euros = z.number().int().min(0);

export const proposalCostsSchema = z.object({
  travelPerPerson: euros,
  travelTotal: euros,
  lodgingTotal: euros,
  onSiteTotal: euros,
  total: euros,
});

export const tripProposalSchema = z.object({
  destination: z.string().min(1),
  country: z.string().min(1),
  whyItFits: z.string().min(1),
  highlights: z.array(z.string().min(1)),
  costs: proposalCostsSchema,
});

export const discoverTripsResponseSchema = z.object({
  proposals: z.array(tripProposalSchema),
});

export type ProposalCosts = z.infer<typeof proposalCostsSchema>;
export type TripProposal = z.infer<typeof tripProposalSchema>;
export type DiscoverTripsResponse = z.infer<typeof discoverTripsResponseSchema>;
