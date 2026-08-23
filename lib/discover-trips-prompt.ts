import { differenceInCalendarDays } from "date-fns";
import { toCalendarDate } from "./calendar-date";
import type { DiscoverTripsRequest } from "./discover-trips-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";

// Numero pari di proposte: la griglia dei risultati è a due colonne da `sm` in su,
// quindi un numero dispari lascerebbe l'ultima card spaiata. Il filtro lato server
// può comunque ridurne il numero, e la griglia sa gestire anche quel caso.
export const PROPOSALS_COUNT = 6;

export function buildDiscoverTripsPrompt(request: DiscoverTripsRequest): string {
  const { departureCity, dateRange, flexiblePeriod, participants, budget, vacationType } = request;
  const travelerCount = participants.length;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  const vacationTypeSection = vacationType?.trim()
    ? `\nTipo di vacanza desiderato: ${vacationType.trim()}. Tutte le proposte devono essere coerenti con questo tipo di vacanza.\n`
    : "";

  const dayCount = dateRange
    ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
    : flexiblePeriod!.nights + 1;

  const dateSection = dateRange
    ? // In ISO come le date che il prompt chiede indietro (suggestedFrom/suggestedTo):
      // dd/MM/yyyy è ambiguo con il formato americano, e qui l'ambiguità si paga in
      // stagionalità — un settembre letto come ottobre cambia i prezzi delle proposte.
      `Date: dal ${toCalendarDate(dateRange.from)} al ${toCalendarDate(dateRange.to)} (${dayCount} giorni)`
    : `Periodo: mese di ${flexiblePeriod!.month}, soggiorno di ${flexiblePeriod!.nights} notti (${dayCount} giorni). Le date esatte non sono ancora state scelte: per ogni proposta scegli tu la finestra di ${flexiblePeriod!.nights} notti migliore dentro questo mese, e spiega la scelta in whyItFits in base a prezzi, meteo o eventi nel periodo. Restituisci la finestra scelta come suggestedFrom e suggestedTo, entrambe date in formato YYYY-MM-DD, entrambe dentro il mese ${flexiblePeriod!.month} e a distanza di esattamente ${flexiblePeriod!.nights} notti l'una dall'altra.`;

  const suggestedFieldsSection = flexiblePeriod
    ? `\n- suggestedFrom: la data di inizio scelta per questa proposta, in formato YYYY-MM-DD, dentro il mese ${flexiblePeriod.month}.
- suggestedTo: la data di fine scelta per questa proposta, in formato YYYY-MM-DD, esattamente ${flexiblePeriod.nights} notti dopo suggestedFrom.`
    : "";

  return `Il viaggiatore non ha ancora scelto una destinazione: sa solo quanto può spendere, quando parte, da dove e con chi. Proponi ${PROPOSALS_COUNT} proposte di viaggio compatibili con questi vincoli.

Città di partenza: ${departureCity}
${dateSection}
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
  - total: la somma esatta di travelTotal, lodgingTotal e onSiteTotal.${suggestedFieldsSection}

Vincoli da rispettare:
- Il totale di ogni proposta non deve superare ${budget}€. Una proposta fuori budget è inutile: meglio una meta più vicina o più economica.
- Le ${PROPOSALS_COUNT} proposte devono essere diverse tra loro per meta e carattere del viaggio, non varianti della stessa idea né città dello stesso paese.
- Le destinazioni devono essere raggiungibili dalla città di partenza indicata nell'arco di date indicato.
- Adatta le mete alla composizione del gruppo: con bambini/e evita viaggi con voli molto lunghi o mete faticose.
- Il mezzo di trasporto implicito in travelPerPerson deve essere coerente con quanto scritto in whyItFits: se whyItFits parla di treno, traghetto o "via terra", travelPerPerson deve rispecchiare il costo di quel mezzo, non quello di un volo.
- Scrivi in italiano whyItFits e tutti e tre gli highlights, anche per destinazioni di lingua inglese o comunque straniera: chi legge è italiano. Anche destination e country vanno in italiano dove esiste la forma italiana consueta (Londra, non London; Regno Unito, non United Kingdom). Fanno eccezione i nomi propri di luoghi, musei, monumenti, locali e piatti tipici, che restano nella lingua originale e non vanno tradotti: "Mercado da Ribeira", non "Mercato della Ribeira"; "Temple Bar", non "Bar del Tempio". In italiano va la prosa attorno al nome, non il nome.
- Le cifre sono stime indicative: restituisci numeri realistici e prudenti, senza mai spacciarli per prezzi verificati.`;
}
