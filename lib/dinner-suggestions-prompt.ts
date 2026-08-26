import type { Participant } from "./schema";
import type { DinnerCandidate } from "./dinner-candidates";
import { MAX_DINNER_COMMENT_LENGTH } from "./dinner-suggestions-schema";

export interface DinnerPromptDay {
  date: string;
  anchorTitle: string;
  candidates: DinnerCandidate[];
}

export interface DinnerPromptInput {
  destination: string;
  participants: Participant[];
  budget: number;
  styleNotes?: string;
  days: DinnerPromptDay[];
}

function descriviCandidato(candidate: DinnerCandidate): string {
  const dettagli = [
    `${candidate.distanceMeters} m`,
    candidate.cuisine ? `cucina: ${candidate.cuisine}` : null,
    candidate.openingHours ? `orari: ${candidate.openingHours}` : null,
    candidate.street ? `via: ${candidate.street}` : null,
  ].filter(Boolean);

  return `  ${candidate.id}. ${candidate.name} (${dettagli.join(", ")})`;
}

function descriviGruppo(participants: Participant[]): string {
  return participants.map((p) => `${p.type} di ${p.age} anni`).join(", ");
}

export function buildDinnerSuggestionsPrompt(input: DinnerPromptInput): string {
  const giornate = input.days
    .map(
      (day) =>
        `Giornata ${day.date} — a fine pomeriggio il viaggiatore si trova a "${day.anchorTitle}".\nLocali disponibili:\n${day.candidates.map(descriviCandidato).join("\n")}`
    )
    .join("\n\n");

  return `Stai consigliando dove cenare a chi sta viaggiando a ${input.destination}.

Gruppo: ${descriviGruppo(input.participants)}. Budget complessivo del viaggio: ${input.budget} euro.${
    input.styleNotes ? `\nStile di viaggio dichiarato: ${input.styleNotes}` : ""
  }

Per ogni giornata ricevi un elenco numerato di locali che esistono davvero, con la distanza dal punto in cui il viaggiatore si trova. Scegline uno per giornata.

${giornate}

Regole, in ordine di importanza:

1. Scegli SOLO fra i locali dell'elenco di quella giornata, indicandone il numero nel campo "chosenId". Non nominare, non suggerire e non inventare locali che non siano in elenco: se nessuno ti convince, scegli comunque il meno peggio fra quelli dati.
2. Il campo "date" deve riportare la stringa esatta della giornata così com'è scritta qui sopra.
3. Nel campo "comment" spiega in italiano perché quello, per questa sera e per questo gruppo: massimo ${MAX_DINNER_COMMENT_LENGTH} caratteri. Scrivi al viaggiatore, non di lui.
4. Non tradurre i nomi propri dei locali e dei luoghi: "Adega São Nicolau" resta tale, non diventa "Cantina San Nicola". In italiano va la prosa attorno al nome, non il nome.
5. Molti locali non hanno indicato cucina né orari: è normale, non è un motivo per scartarli. Usa quello che sai del posto e della zona.
6. Varia: non scegliere lo stesso tipo di locale tutte le sere.`;
}
