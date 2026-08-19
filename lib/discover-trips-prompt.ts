import { differenceInCalendarDays, format } from "date-fns";
import type { DiscoverTripsRequest } from "./discover-trips-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";

export const PROPOSALS_COUNT = 5;

export function buildDiscoverTripsPrompt(request: DiscoverTripsRequest): string {
  const { departureCity, dateRange, participants, budget, vacationType } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const travelerCount = participants.length;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  const vacationTypeSection = vacationType?.trim()
    ? `\nTipo di vacanza desiderato: ${vacationType.trim()}. Tutte le proposte devono essere coerenti con questo tipo di vacanza.\n`
    : "";

  return `Il viaggiatore non ha ancora scelto una destinazione: sa solo quanto può spendere, quando parte, da dove e con chi. Proponi ${PROPOSALS_COUNT} proposte di viaggio compatibili con questi vincoli.

Città di partenza: ${departureCity}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget totale disponibile per l'intero gruppo: ${budget}€
Viaggiatori: ${travelerCount} ${travelerCount === 1 ? "viaggiatore" : "viaggiatori"}
${participantsList}
${vacationTypeSection}
Per ogni proposta fornisci:
- destination: la città di destinazione.
- country: il paese in cui si trova.
- whyItFits: una frase che spiega perché questa meta funziona con il budget, il periodo e la composizione del gruppo indicati. Parla al viaggiatore, non di lui.
- highlights: esattamente tre punti salienti brevi (massimo 40 caratteri l'uno), cose concrete che si possono fare o vedere lì. Non frasi generiche come "cultura e relax".
- costs: la ripartizione completa della spesa, in euro, come numeri interi senza simboli né testo:
  - travelPerPerson: il costo indicativo del viaggio di andata e ritorno per una persona, con il mezzo più sensato per quella tratta e quel periodo (aereo, treno o traghetto), da ${departureCity}. Tieni conto della stagionalità: le stesse date in alta stagione costano più che in bassa.
  - travelTotal: travelPerPerson moltiplicato per ${travelerCount}.
  - lodgingTotal: costo complessivo dell'alloggio per l'intero gruppo per ${dayCount} giorni, coerente con il numero di persone.
  - onSiteTotal: spese in loco per l'intero gruppo (pasti, trasporti locali, ingressi, attività) per l'intera durata.
  - total: la somma esatta di travelTotal, lodgingTotal e onSiteTotal.

Vincoli da rispettare:
- Il totale di ogni proposta non deve superare ${budget}€. Una proposta fuori budget è inutile: meglio una meta più vicina o più economica.
- Le ${PROPOSALS_COUNT} proposte devono essere diverse tra loro per meta e carattere del viaggio, non varianti della stessa idea né città dello stesso paese.
- Le destinazioni devono essere raggiungibili dalla città di partenza indicata nell'arco di date indicato.
- Adatta le mete alla composizione del gruppo: con bambini/e evita viaggi con voli molto lunghi o mete faticose.
- Il mezzo di trasporto implicito in travelPerPerson deve essere coerente con quanto scritto in whyItFits: se whyItFits parla di treno, traghetto o "via terra", travelPerPerson deve rispecchiare il costo di quel mezzo, non quello di un volo.
- Le cifre sono stime indicative: restituisci numeri realistici e prudenti, senza mai spacciarli per prezzi verificati.`;
}
