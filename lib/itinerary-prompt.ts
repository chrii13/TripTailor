import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";

export function buildItineraryPrompt(request: GenerateItineraryRequest): string {
  const { destination, dateRange, participants, budget, styleNotes } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}

Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività. Adatta il numero di attività alla situazione: se un'attività è sostanziosa e occupa ragionevolmente l'intera fascia (es. un grande museo, un'escursione fuori porta), lasciala da sola; altrimenti proponi 2-3 attività più brevi con orari che si susseguono senza sovrapporsi. Non imporre un numero fisso di attività per fascia: valuta caso per caso.

Per ogni attività fornisci:
- title: titolo breve.
- description: breve descrizione.
- estimatedCost: stima indicativa del costo (es. "~15€" o "Gratuito").
- suggestedTime: fascia oraria consigliata per quella specifica attività, nel formato "HH:MM–HH:MM" (es. "10:00–12:30") — deve rientrare nella fascia della giornata (mattina/pomeriggio/sera) e non sovrapporsi con le altre attività della stessa fascia.
- openingHours: orari di apertura/chiusura del luogo, solo dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata). Ometti il campo quando non applicabile.
- details: un oggetto con tre campi pensati per un viaggiatore che non conosce affatto la zona:
  - about: cosa è il posto o l'attività.
  - gettingThere: come raggiungerlo, tenendo conto di dove si trova il viaggiatore nell'itinerario in quel momento.
  - tips: consigli pratici utili (es. quando evitare la fila, cosa portare, aspetti da sapere in anticipo).

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini/e (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi/e (13-25 anni) ma nessun bambino/a: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un/a sedicenne, a meno che tutti i "ragazzi/e" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti/e (26+ anni), nessun bambino/a o ragazzo/a: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini/e, la giornata resta family-friendly anche con adulti/e nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Non fare alcun riferimento alle condizioni climatiche. Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
