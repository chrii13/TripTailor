/**
 * Budget di tempo per le chiamate a Gemini dentro il vincolo `maxDuration` di Vercel.
 *
 * La piattaforma termina la funzione a `maxDuration` secondi qualunque cosa faccia il
 * nostro codice: se una chiamata (o un giro di fallback su modelli/chiavi diverse)
 * supera quel limite, l'utente vede un 504 grezzo della piattaforma invece del
 * messaggio in italiano gestito dalla route. Queste funzioni pure calcolano quanto
 * tempo resta prima della scadenza e quanto concedere al prossimo tentativo, così la
 * route può accorciare il timeout di un tentativo tardivo, o rinunciare del tutto
 * prima di iniziare una chiamata che non potrebbe comunque completare in tempo.
 */

export interface CallAttemptBudget {
  /** Tempo restante fino alla scadenza, in ms (può essere negativo a scadenza superata). */
  remainingMs: number;
  /**
   * Timeout in ms da assegnare al prossimo tentativo, oppure null se il tempo
   * restante è sotto la soglia minima e non vale la pena tentare.
   */
  callTimeoutMs: number | null;
}

/** Istante (epoch ms) entro cui la route deve aver restituito una risposta. */
export function computeDeadline(startTime: number, usableBudgetMs: number): number {
  return startTime + usableBudgetMs;
}

/**
 * Calcola quanto tempo resta prima della scadenza e il timeout da assegnare al
 * prossimo tentativo. Il timeout restituito è sempre il minimo tra `perCallCapMs`
 * e il tempo davvero rimasto: un tentativo che parte a ridosso della scadenza
 * riceve un guinzaglio corto, non l'intero tetto per chiamata. Per costruzione
 * nessun tentativo può quindi durare più del tempo rimasto in quel momento, e la
 * somma di tutti i tentativi non può mai superare `usableBudgetMs`.
 *
 * @param minRemainingMs sotto questa soglia non ha senso iniziare un altro
 *   tentativo: la chiamata non riuscirebbe a fare un giro di andata e ritorno
 *   utile prima della scadenza, quindi è meglio rinunciare subito.
 */
export function getCallAttemptBudget(
  deadline: number,
  now: number,
  perCallCapMs: number,
  minRemainingMs: number
): CallAttemptBudget {
  const remainingMs = deadline - now;
  if (remainingMs < minRemainingMs) {
    return { remainingMs, callTimeoutMs: null };
  }
  return { remainingMs, callTimeoutMs: Math.min(perCallCapMs, remainingMs) };
}
