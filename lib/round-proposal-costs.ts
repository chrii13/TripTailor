import type { ProposalCosts } from "./discover-trips-schema";

// Il sistema non ha una precisione al singolo euro: tre esecuzioni identiche
// possono dare la stessa meta a 1170 / 1010 / 1390€. Arrotondare alla
// cinquantina più vicina evita di promettere una precisione che non esiste.
const ROUND_TO = 50;

export function roundToNearestFifty(value: number): number {
  return Math.round(value / ROUND_TO) * ROUND_TO;
}

export type RoundedProposalCosts = {
  travelPerPerson: number;
  travelTotal: number;
  lodgingTotal: number;
  onSiteTotal: number;
  total: number;
};

/**
 * Arrotonda le singole voci di costo alla cinquantina più vicina e deriva il
 * totale mostrato dalla somma delle voci già arrotondate: così le righe della
 * card tornano sempre con il totale, invece di arrotondare il totale per conto
 * proprio e rischiare uno scarto visibile.
 */
export function roundProposalCosts(costs: ProposalCosts): RoundedProposalCosts {
  const travelTotal = roundToNearestFifty(costs.travelTotal);
  const lodgingTotal = roundToNearestFifty(costs.lodgingTotal);
  const onSiteTotal = roundToNearestFifty(costs.onSiteTotal);

  return {
    travelPerPerson: roundToNearestFifty(costs.travelPerPerson),
    travelTotal,
    lodgingTotal,
    onSiteTotal,
    total: travelTotal + lodgingTotal + onSiteTotal,
  };
}
