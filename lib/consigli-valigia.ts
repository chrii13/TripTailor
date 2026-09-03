import type { DailyClimateAverage } from "./climate-forecast";

/**
 * Oltre questa percentuale di anni con pioggia la giornata conta come piovosa.
 * La soglia è stretta (`>`, non `>=`): 30% esatto non fa scattare niente, perché
 * un anno su tre non è una ragione per portarsi la giacca.
 */
const SOGLIA_PIOGGIA = 30;

/**
 * Oltre questa differenza fra massima e minima nella stessa giornata si consiglia
 * di vestirsi a strati: la stessa giornata chiede due cose diverse. Anche qui la
 * soglia è stretta.
 */
const SOGLIA_ESCURSIONE = 10;

export interface ConsigliValigia {
  voci: string[];
  /** La massima più alta del periodo, per la riga di contesto della resa. */
  massima: number;
  /** La minima più bassa del periodo. */
  minima: number;
}

/**
 * Le fasce sono decise sulla massima più alta **e** sulla minima più bassa del
 * periodo, non su una media: una media fra 3° e 22° dà 12°, cioè una giornata che
 * in quel viaggio non esiste. Per questo un viaggio può far scattare due fasce, e
 * in quel caso valgono entrambe.
 *
 * I confini sono inclusivi a sinistra: 12° sta in "5-12", 13° in "13-19".
 */
const FASCE = [
  { minimo: -Infinity, capi: ["Un cappotto pesante, guanti, berretto e sciarpa"] },
  // Il capo non nomina gli strati di proposito: sovrapporre i capi risponde alla
  // differenza fra giorno e notte, non a una temperatura bassa, ed è la voce
  // dell'escursione a dirlo — una volta sola e solo quando serve davvero.
  { minimo: 5, capi: ["Una giacca calda, un maglione, scarpe chiuse"] },
  { minimo: 13, capi: ["Maglie a maniche lunghe, una felpa o un cardigan per la sera"] },
  // La sera fresca è nominata **solo** dalla fascia 13-19. Dirla anche qui faceva
  // sì che il viaggio più comune che esista — minima 15°, massima 22°, cioè due
  // fasce adiacenti insieme — leggesse quasi la stessa frase due volte, e il Set
  // non poteva accorgersene perché le due stringhe differiscono. Quando la sera
  // conta davvero, o scatta la fascia inferiore o scatta la regola dell'escursione.
  { minimo: 20, capi: ["Abbigliamento leggero e comodo"] },
  { minimo: 27, capi: ["Tessuti leggeri e traspiranti, un cappello, protezione solare"] },
] as const;

function fasciaDi(gradi: number): (typeof FASCE)[number] {
  // Si scorre dalla più calda: la prima soglia raggiunta è la fascia giusta.
  return [...FASCE].reverse().find((fascia) => gradi >= fascia.minimo) ?? FASCE[0];
}

/**
 * Dalla media climatica del periodo alla lista di cosa portare. Funzione pura:
 * niente rete, niente modello, niente da verificare oltre l'aritmetica — ed è la
 * ragione per cui questa funzionalità non ha uno schema di risposta né un cancello,
 * a differenza dei consigli sulla cena.
 *
 * Restituisce `null` quando non c'è niente da dire, così chi la usa non deve
 * decidere da sé se il blocco vada mostrato. Senza dati climatici il blocco non
 * compare affatto: nessun consiglio è meglio di un consiglio senza fondamento.
 *
 * Una media **parziale** va invece benissimo: `getClimateAverages` degrada di
 * proposito a meno anni quando il tempo stringe, e buttare via il consiglio per
 * quello sarebbe assurdo.
 */
export function costruisciConsigliValigia(
  clima: DailyClimateAverage[] | null
): ConsigliValigia | null {
  if (!clima || clima.length === 0) return null;

  const massima = Math.max(...clima.map((g) => g.tempMaxAvg));
  const minima = Math.min(...clima.map((g) => g.tempMinAvg));

  // Un Set perché in un viaggio mite le due fasce coincidono, e la stessa voce
  // ripetuta due volte sarebbe un difetto visibile.
  const voci = new Set<string>();
  for (const capi of [fasciaDi(minima).capi, fasciaDi(massima).capi]) {
    for (const capo of capi) voci.add(capo);
  }

  const escursione = Math.max(...clima.map((g) => g.tempMaxAvg - g.tempMinAvg));
  if (escursione > SOGLIA_ESCURSIONE) {
    // La frase parte dal dato e non dall'ordine: sono medie storiche, e "fra il
    // giorno e la notte ci sono N gradi" al presente suonerebbe come una promessa
    // sul tempo che farà. È l'unica voce che si apre con un fatto invece che con
    // un capo, ed è per questo che "In media" la identifica da sola.
    voci.add(
      `In media ci sono circa ${Math.round(escursione)} gradi fra il giorno e la notte: vestiti a strati`
    );
  }

  const giornatePiovose = clima.filter((g) => g.precipitationChance > SOGLIA_PIOGGIA).length;
  if (giornatePiovose > 0) {
    voci.add("Una giacca impermeabile leggera");
  }
  if (giornatePiovose > clima.length / 2) {
    voci.add("Scarpe che tengano l'acqua");
  }

  return { voci: [...voci], massima, minima };
}
