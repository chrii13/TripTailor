import { z } from "zod";

const euros = z.number().int().min(0);

export const proposalCostsSchema = z.object({
  travelPerPerson: euros,
  travelTotal: euros,
  lodgingTotal: euros,
  onSiteTotal: euros,
  total: euros,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida, usa il formato YYYY-MM-DD");

export const tripProposalSchema = z
  .object({
    destination: z.string().min(1),
    country: z.string().min(1),
    whyItFits: z.string().min(1),
    highlights: z.array(z.string().min(1)),
    costs: proposalCostsSchema,
    // Presenti solo in modalità "periodo flessibile": la finestra di date scelta dal modello
    // dentro il mese richiesto. In modalità date esatte non compaiono.
    suggestedFrom: isoDate.optional(),
    suggestedTo: isoDate.optional(),
  })
  .refine((proposal) => (proposal.suggestedFrom === undefined) === (proposal.suggestedTo === undefined), {
    message: "suggestedFrom e suggestedTo devono essere entrambi presenti o entrambi assenti",
    path: ["suggestedFrom"],
  });

export const discoverTripsResponseSchema = z.object({
  proposals: z.array(tripProposalSchema),
});

export type ProposalCosts = z.infer<typeof proposalCostsSchema>;
export type TripProposal = z.infer<typeof tripProposalSchema>;
export type DiscoverTripsResponse = z.infer<typeof discoverTripsResponseSchema>;
