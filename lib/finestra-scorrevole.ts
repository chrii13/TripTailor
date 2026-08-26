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
  };
}
