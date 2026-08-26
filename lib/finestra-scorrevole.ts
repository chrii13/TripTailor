import { attendi } from "./attesa";

/**
 * Una finestra scorrevole fra chiamate a un servizio esterno: non una pausa fissa, ma
 * l'attesa del tempo che *manca* al prossimo intervallo, contato dall'inizio della chiamata
 * precedente. Una chiamata lenta non paga quindi nulla, e il costo di distanziamento per
 * gruppo resta al massimo `intervalloMs`.
 *
 * Vive in un modulo suo perché serve a due servizi diversi con lo stesso disegno —
 * LocationIQ nella fase 1a e Overpass nella 1b di `/api/dinner-suggestions` — e perché
 * chiama `attendi`, che i test sostituiscono: mantenendo qui il *calcolo* dei millisecondi,
 * un test che sostituisce `attendi` vede comunque il valore vero.
 */
export interface FinestraScorrevole {
  /** Quanto manca al prossimo intervallo. Può essere negativo: vuol dire che si può partire. */
  attesaMs(): number;
  /** Aspetta quel che manca (niente, se è già passato) e apre la finestra successiva. */
  distanzia(): Promise<void>;
  /**
   * Riporta l'inizio della finestra a **adesso**. Serve a chi vuole contare l'intervallo
   * dalla *fine* della chiamata precedente invece che dal suo inizio: lo si chiama quando
   * la chiamata è finita.
   *
   * I due modi non sono intercambiabili, e la scelta dipende da cosa impone il servizio.
   * Chi limita la **frequenza** (LocationIQ: due richieste al secondo) va contato
   * dall'inizio, che è il momento che il servizio conta. Chi limita le richieste
   * **simultanee** (Overpass: due slot) va contato dalla fine, perché è lì che lo slot si
   * libera — e contarlo dall'inizio farebbe partire senza pausa proprio la richiesta che
   * segue una andata in timeout, cioè il caso in cui la cautela serve di più.
   */
  riapri(): void;
}

/**
 * `inizio` è il momento da cui contare la prima finestra. Il valore di default — adesso —
 * è quello giusto quando la chiamata che apre la finestra è *appena partita* (la
 * geocodifica della destinazione). Passando `0` (l'epoch) la prima finestra risulta invece
 * già scaduta, che è il caso di chi non ha nulla da cui distanziarsi.
 */
export function finestraScorrevole(intervalloMs: number, inizio: number = Date.now()): FinestraScorrevole {
  let apertura = inizio;
  const attesaMs = () => intervalloMs - (Date.now() - apertura);

  return {
    attesaMs,
    async distanzia() {
      const ms = attesaMs();
      // Si chiama `attendi` solo quando c'è davvero da aspettare: così una finestra già
      // scaduta non lascia tracce, e un test può contare le attese vere.
      if (ms > 0) await attendi(ms);
      apertura = Date.now();
    },
    riapri() {
      apertura = Date.now();
    },
  };
}
