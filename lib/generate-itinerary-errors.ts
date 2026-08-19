import { ApiError } from "@google/genai";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";

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
