import type { TripProposal } from "./discover-trips-schema";

/**
 * In modalità date esatte il modello valorizza comunque suggestedFrom/suggestedTo
 * (echeggiando le date richieste), perché i campi sono nello schema JSON condiviso
 * con la modalità periodo flessibile. Il dato non fa danno, ma renderebbe la card
 * ridondante: li rimuoviamo quando la richiesta non era in modalità flessibile, così
 * i due campi esistono solo quando hanno davvero un'informazione da dare.
 */
export function stripSuggestedWindowIfExact(
  proposals: TripProposal[],
  isFlexible: boolean
): TripProposal[] {
  if (isFlexible) return proposals;
  return proposals.map((proposal) => {
    const { suggestedFrom, suggestedTo, ...rest } = proposal;
    void suggestedFrom;
    void suggestedTo;
    return rest;
  });
}
