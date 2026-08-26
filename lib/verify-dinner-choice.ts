import type { DinnerCandidate } from "./dinner-candidates";

/**
 * Il cancello. Il modello restituisce un identificativo, non un nome: se quell'id non è
 * fra i candidati che gli abbiamo dato, la scelta si scarta. Un identificativo inventato
 * non produce un locale inventato, produce uno scarto.
 *
 * Nome, indirizzo e distanza mostrati a schermo vengono da qui — cioè dai dati OSM — e
 * mai dalla risposta del modello.
 */
export function resolveDinnerChoice(
  candidates: DinnerCandidate[],
  chosenId: number
): DinnerCandidate | null {
  return candidates.find((candidate) => candidate.id === chosenId) ?? null;
}
