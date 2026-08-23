import type { ProposalCosts } from "./discover-trips-schema";

// Il sistema non ha una precisione al singolo euro: tre esecuzioni identiche
// possono dare la stessa meta a 1170 / 1010 / 1390€. Arrotondare evita di
// promettere una precisione che non esiste. Ma un arrotondamento fisso alla
// cinquantina trasforma qualsiasi cifra sotto i 25€ in "0€", che si legge
// come "gratis" — un errore di fatto per gite in giornata o tratte brevi.
// Sotto i 100€ si arrotonda alla cinquina (la variabilità del ±20% riguarda
// le grandi cifre stimate dall'AI, non un biglietto del treno da 10€); da
// 100€ in su resta la cinquantina.
const SMALL_AMOUNT_CUTOFF = 100;
const SMALL_STEP = 5;
const LARGE_STEP = 50;

export function roundToNearestFifty(value: number): number {
  if (value === 0) return 0;

  const step = Math.abs(value) < SMALL_AMOUNT_CUTOFF ? SMALL_STEP : LARGE_STEP;
  const rounded = Math.round(value / step) * step;

  // Un importo reale ma piccolo (es. 2€) non deve mai apparire come "0€":
  // si legge come gratis, che è falso. Se l'arrotondamento alla cinquina
  // porta a 0, si mostra comunque lo step minimo (5€).
  if (rounded === 0) return step;

  return rounded;
}

export type RoundedProposalCosts = {
  travelTotal: number;
  lodgingTotal: number;
  onSiteTotal: number;
  total: number;
};

/**
 * Arrotonda le singole voci di costo (cinquina sotto i 100€, cinquantina da
 * 100€ in su) e deriva il totale mostrato dalla somma delle voci già
 * arrotondate: così le righe della card tornano sempre con il totale, invece
 * di arrotondare il totale per conto proprio e rischiare uno scarto visibile.
 */
export function roundProposalCosts(costs: ProposalCosts): RoundedProposalCosts {
  const travelTotal = roundToNearestFifty(costs.travelTotal);
  const lodgingTotal = roundToNearestFifty(costs.lodgingTotal);
  const onSiteTotal = roundToNearestFifty(costs.onSiteTotal);

  return {
    travelTotal,
    lodgingTotal,
    onSiteTotal,
    total: travelTotal + lodgingTotal + onSiteTotal,
  };
}
