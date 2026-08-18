import { differenceInCalendarDays, format } from "date-fns";
import type { GenerateItineraryRequest } from "./generate-itinerary-request";
import { PARTICIPANT_TYPE_LABELS } from "./schema";
import type { DailyClimateAverage } from "./climate-forecast";

export function buildItineraryPrompt(
  request: GenerateItineraryRequest,
  climate: DailyClimateAverage[] | null
): string {
  const { destination, dateRange, participants, budget, styleNotes, mustSee, arrivalTime, departureTime } =
    request;
  const dayCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  const participantsList = participants
    .map((p) => `- ${PARTICIPANT_TYPE_LABELS[p.type]}, ${p.age} anni`)
    .join("\n");

  const arrivalDepartureLines: string[] = [];
  if (arrivalTime) {
    arrivalDepartureLines.push(
      `Il viaggiatore arriva a destinazione il primo giorno (${format(dateRange.from, "dd/MM/yyyy")}) alle ${arrivalTime}: non pianificare attività prima di quell'orario, lasciando un margine ragionevole per il trasferimento e il check-in in alloggio.`
    );
  }
  if (departureTime) {
    arrivalDepartureLines.push(
      `Il viaggiatore riparte l'ultimo giorno (${format(dateRange.to, "dd/MM/yyyy")}) alle ${departureTime}: concludi le attività con un margine ragionevole prima di quell'orario, per il rientro verso aeroporto/stazione.`
    );
  }
  const arrivalDepartureSection =
    arrivalDepartureLines.length > 0 ? `\n${arrivalDepartureLines.join("\n")}\n` : "";

  const mustSeeSection = mustSee?.trim()
    ? `
Tappa imperdibile richiesta dal viaggiatore: ${mustSee.trim()}
Inseriscila come attività vera e propria in uno dei giorni, con orario e costo come le altre, scegliendo il giorno e la fascia più sensati per posizione geografica e orari di apertura — non limitarti a nominarla dentro la descrizione di un'altra attività. Se non è raggiungibile nell'arco del viaggio o non esiste nella zona, inserisci comunque l'alternativa più vicina possibile e spiegalo nel campo tips.
`
    : "";

  const climateSection =
    climate && climate.length > 0
      ? `\nClima tipico atteso (media degli ultimi 5 anni per queste date — non è una previsione esatta, ma un'indicazione di massima):\n${climate
          .map(
            (day) =>
              `- ${day.date}: ~${day.tempMaxAvg}°C/${day.tempMinAvg}°C, pioggia in circa ${day.precipitationChance}% degli anni passati`
          )
          .join("\n")}\nUsa questi dati per calibrare le attività di ogni giorno: nei giorni con probabilità di pioggia più alta, preferisci attività al coperto o facilmente spostabili; tieni conto delle temperature per il ritmo della giornata. Non è necessario menzionare esplicitamente il meteo nelle descrizioni delle attività — usalo solo per orientare le scelte.\n`
      : "";

  return `Genera un itinerario di viaggio dettagliato per il seguente viaggio.

Destinazione: ${destination}
Date: dal ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")} (${dayCount} giorni)
Budget indicativo totale: ${budget}€
Viaggiatori:
${participantsList}
${styleNotes ? `Note sullo stile di viaggio: ${styleNotes}` : ""}
${arrivalDepartureSection}${mustSeeSection}
${climateSection}
Genera un piano giorno per giorno, con una data (formato YYYY-MM-DD) per ogni giorno del viaggio, diviso in tre fasce orarie (mattina, pomeriggio, sera). Per ogni fascia, elenca una o più attività. Adatta il numero di attività alla situazione: se un'attività è sostanziosa e occupa ragionevolmente l'intera fascia (es. un grande museo, un'escursione fuori porta), lasciala da sola; altrimenti proponi 2-3 attività più brevi con orari che si susseguono senza sovrapporsi. Non imporre un numero fisso di attività per fascia: valuta caso per caso, ed evita di ripetere lo stesso schema identico ogni giorno (es. sempre una sola attività a mattina e sera e due nel pomeriggio) — varia in base a cosa offre davvero la destinazione quel giorno. Se in una fascia hai più momenti distinti da proporre (es. cena e poi una passeggiata/bar/spettacolo serale), elencali come attività separate nell'elenco, ciascuna con il proprio orario, invece di descriverli insieme in un'unica voce.

Per ogni attività fornisci:
- title: nome del luogo o dell'attività, massimo 40 caratteri. Deve stare su una riga sola: solo il nome, senza congiunzioni che uniscono due momenti diversi (es. "Monastero dei Jerónimos", non "Cena panoramica nel Bairro Alto e brindisi al Miradouro"). Se hai due momenti distinti da proporre, sono due attività separate, non un titolo lungo.
- description: breve descrizione, una frase.
- estimatedCost: stima indicativa del costo (es. "~15€" o "Gratuito").
- suggestedTime: fascia oraria consigliata per quella specifica attività, nel formato "HH:MM–HH:MM" (es. "10:00–12:30") — deve rientrare nella fascia della giornata (mattina/pomeriggio/sera) e non sovrapporsi con le altre attività della stessa fascia.
- openingHours: orari di apertura/chiusura del luogo, solo dove pertinente (musei, monumenti, locali — non per attività generiche come una passeggiata). Ometti il campo quando non applicabile.
- details: un oggetto con tre campi pensati per un viaggiatore che non conosce affatto la zona:
  - about: cosa è il posto o l'attività.
  - gettingThere: come raggiungerlo. Per la primissima attività di ogni giornata non è possibile sapere da dove parte il viaggiatore (potrebbe essere l'alloggio, un'altra zona, ecc.): indica quindi la posizione esatta del luogo (zona/quartiere, indirizzo indicativo) e come raggiungerlo in generale (es. fermata metro/bus più vicina, punto di riferimento), non partendo da un punto preciso presunto. Per le attività successive nella stessa giornata, indica invece come arrivarci dall'attività precedente nell'itinerario.
  - tips: consigli pratici utili (es. quando evitare la fila, cosa portare, aspetti da sapere in anticipo).

Adatta ritmo e tipo di attività alla composizione del gruppo:
- Se sono presenti bambini/e (0-12 anni): ritmo rilassato, poche attività per fascia, pause frequenti, orari non troppo mattinieri, pasti a orari regolari. Preferisci parchi, zoo/acquari, musei interattivi/scientifici, attività family-friendly. Evita vita notturna, locali per adulti, trekking impegnativi o attività con lunghe attese in piedi/code.
- Se sono presenti ragazzi/e (13-25 anni) ma nessun bambino/a: ritmo più dinamico, mix di cultura leggera e intrattenimento, attività social/esperienziali (punti panoramici, esperienze fotografiche, sport leggeri/acquatici, escursioni brevi). Non presumere accesso a locali/nightlife per l'intera fascia, dato che include minorenni (13-17): resta su attività adatte anche a un/a sedicenne, a meno che tutti i "ragazzi/e" del gruppo abbiano età pari o superiore a 18 anni.
- Se sono presenti solo adulti/e (26+ anni), nessun bambino/a o ragazzo/a: ritmo più libero e denso, spazio a vita notturna, trekking impegnativi, esperienze enogastronomiche, cultura senza vincoli di tempo ridotti. Usa l'età precisa per calibrare il tono: un gruppo di ventenni e uno di cinquantenni sono entrambi "adulti" ma possono giustificare attività diverse.
- In gruppi misti, il ritmo si adatta al membro più vincolante: se ci sono bambini/e, la giornata resta family-friendly anche con adulti/e nel gruppo, con una sera tranquilla piuttosto che vita notturna.

Rispetta il budget indicativo indicato nella somma delle stime di costo.`;
}
