import { ApiError } from "@google/genai";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response" | "content_blocked";

export function classifyGenerationError(error: unknown): ErrorCode {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "config";
    }
    if (error.status === 429) {
      return "rate_limit";
    }
    if (error.status >= 500) {
      return "network";
    }
    return "invalid_response";
  }
  return "network";
}

export type FinishReasonOutcome = "complete" | "retry" | "blocked";

// I motivi con cui Gemini dichiara di aver fermato la generazione per contenuto: sono
// una proprietà della richiesta, non del modello o della chiave, quindi ripeterla altrove
// darebbe lo stesso esito spendendo altri token.
const BLOCKING_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "IMAGE_SAFETY",
]);

/**
 * Il `finishReason` dice se la risposta è finita o è stata interrotta a metà, e va letto
 * PRIMA del JSON.parse: una generazione troncata a metà (MAX_TOKENS) produce un JSON
 * spezzato, che senza questo controllo diventa un `invalid_response` definitivo — l'utente
 * ricarica e riceve lo stesso errore, perché il ciclo su modelli e chiavi era già uscito
 * sul successo HTTP. Un troncamento merita un altro tentativo (il modello successivo è più
 * conciso); un blocco di contenuto no, e va detto all'utente per quello che è.
 *
 * L'assenza del campo vale come completamento: non tutte le risposte lo riportano, e
 * trattarla come interruzione butterebbe via generazioni valide.
 */
export function classifyFinishReason(finishReason: string | undefined): FinishReasonOutcome {
  if (finishReason === undefined || finishReason === "STOP") return "complete";
  if (BLOCKING_FINISH_REASONS.has(finishReason)) return "blocked";
  return "retry";
}

/**
 * Riconosce l'abort generato dal nostro stesso timeout per-tentativo
 * (`httpOptions.timeout` dell'SDK Gemini), distinto da un errore di rete "vero".
 * `classifyGenerationError` continua a classificarlo come "network" (stesso
 * ErrorCode, stesso messaggio per l'utente): questa funzione serve solo alla
 * route per decidere se ha senso spendere altro budget di tempo su un modello o
 * una chiave diversi — un timeout non è un problema specifico del modello, quindi
 * non vale la pena ripeterlo altrove.
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
