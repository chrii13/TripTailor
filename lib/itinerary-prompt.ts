import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import type { ParticipantType } from "./schema";

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

export function buildItineraryPrompt(request: GenerateItineraryRequest): string {
  const { destination, dateRange, participants, budget, styleNotes } = request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}

Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività con titolo, breve descrizione, una stima indicativa del costo (es. "~15€" o "Gratuito") e, dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata), orari di apertura e chiusura indicativi.

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi (13-25 anni) ma nessun bambino: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un sedicenne, a meno che tutti i "ragazzi" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti (26+ anni), nessun bambino/ragazzo: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini, la giornata resta family-friendly anche con adulti nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Non fare alcun riferimento alle condizioni climatiche. Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
