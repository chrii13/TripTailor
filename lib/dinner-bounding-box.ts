/**
 * Il rettangolo che racchiude tutte le tappe d'ancoraggio di un itinerario, cioè l'area su
 * cui si fa **una sola** interrogazione Overpass invece di una per sera.
 *
 * Perché una sola. Misurate il 2026-08-26, sei interrogazioni `around` identiche alle
 * stesse coordinate di Bologna: 1,0s, 1,0s, 16,5s, 10,3s, poi due `429` dopo 10,5s e 10,3s.
 * I rifiuti arrivano *dopo* le prime richieste ravvicinate: erano le nostre stesse sere a
 * limitarci, e più lungo era il viaggio peggio andava. Allargare l'area invece costa poco:
 * sulle stesse coordinate, 600 m di raggio danno 161 locali, 2 km ne danno 440 (165 KB) e
 * 5 km 624 (236 KB), con tempi che dipendono dal servizio e non dal raggio (la stessa
 * interrogazione a 2 km ha impiegato 2,1s una volta e 14,4s un'altra).
 */
export interface Punto {
  lat: number;
  lon: number;
}

export interface Riquadro {
  sud: number;
  ovest: number;
  nord: number;
  est: number;
}

const METRI_PER_GRADO_LAT = 111_320;

/**
 * Il margine aggiunto su ogni lato. Deve restare **più largo di SEARCH_RADIUS_METERS**
 * (600 m): i candidati di ogni sera si scelgono entro quel raggio dalla propria tappa, e
 * una tappa sul bordo del rettangolo avrebbe altrimenti mezzo cerchio di ricerca fuori dai
 * dati scaricati — locali che esistono ma che non vedremmo, senza nessun segnale.
 */
export const MARGINE_METRI = 800;

/**
 * Il tetto all'area del rettangolo, in chilometri quadrati.
 *
 * Il numero è misurato, non stimato (Bologna, 2026-08-26, un'interrogazione per lato):
 *
 *   lato   2 km →     4 km² →  327 locali,  120 KB,  0,8s
 *   lato   5 km →    25 km² →  510 locali,  194 KB,  0,8s
 *   lato  10 km →   100 km² →  655 locali,  247 KB,  1,0s
 *   lato  20 km →   400 km² →  828 locali,  304 KB,  3,9s
 *   lato  30 km →   900 km² →  940 locali,  339 KB,  1,0-1,4s
 *   lato  50 km → 2.500 km² → 1241 locali,  444 KB,  2,3s
 *   lato 100 km → 10.000 km² → 2775 locali,  970 KB,  6,1s
 *   lato 200 km → 40.000 km² → 10409 locali, 3,3 MB, 27,3s
 *
 * Il tetto è sull'**area** e non sul lato perché è l'area a governare il costo: raddoppiare
 * il lato quadruplica l'area, e fra 900 km² e 40.000 km² il tempo passa da ~1s a 27s e la
 * risposta da 339 KB a 3,3 MB. Un tetto sul lato mentirebbe sul prezzo.
 *
 * 900 km² (30 km per 30) è scelto perché copre con abbondanza il caso normale — Roma dentro
 * il Grande Raccordo sta in ~285 km², il comune di Bologna in 141, e le 14 tappe vere di un
 * itinerario bolognese misurate lo stesso giorno danno 47,9 km² col margine — restando nella
 * parte piatta della tabella: ~1,4s e un terzo di megabyte. Oltre, si comincia a pagare.
 *
 * ── Le città dense, misurate il 2026-08-26 (la tabella qui sopra è tutta bolognese) ──
 *
 * Un tetto sull'area non è un tetto sul *carico*: a parità di km² una capitale sta un ordine
 * di grandezza sopra. Gli stessi 900 km², con chiamate vere:
 *
 *   Bologna → 940 elementi,    339 KB,  1,0-1,4s
 *   Londra  → 8.169 elementi,  3,85 MB, 7,9s
 *   Parigi  → 13.916 elementi, 5,56 MB, 6,7s
 *   Tokyo   → 15.746 elementi, 4,39 MB, 3,9s
 *
 * Il tetto **resta 900**, e non c'è nessun limite sul numero di elementi. Le tre ragioni,
 * tutte misurate:
 *
 * 1. Il caso peggiore regge. 5,56 MB si scaricano in 6,7s contro `OVERPASS_TIMEOUT_MS`
 *    (20s), e la parte in casa non si vede: `JSON.parse` più la selezione dei candidati di
 *    quella risposta costano **126 ms e 16 MB di heap**, su una funzione che ne ha 1024.
 * 2. Abbassare la soglia non toglierebbe il carico, perché il carico *sta nel centro*: a
 *    Parigi 400 km² danno già 12.541 elementi e 5,05 MB (il 90% dei byte) e persino 100 km²
 *    ne danno 9.359 per 3,9 MB (il 70%). Si spezzerebbe in due o tre interrogazioni un
 *    itinerario parigino del tutto normale, cioè si tornerebbe alle richieste ripetute che
 *    questo lavoro esiste per eliminare, senza guadagnare quasi nulla in byte.
 * 3. Un tetto sul numero di elementi (`out ... N`) è **peggio del male**: Overpass non
 *    garantisce *quali* elementi sopravvivono al taglio, e a Parigi un tetto di 500 ne
 *    terrebbe il 3,6% scelto senza alcun rapporto con le nostre tappe. Il risultato non
 *    sarebbe un errore ma un consiglio silenziosamente peggiore, o una sera vuota in pieno
 *    centro: esattamente il genere di difetto invisibile che qui si sta cercando di evitare.
 *
 * Queste misure sono anche la conferma indipendente di `OVERPASS_TIMEOUT_MS = 20_000`: con
 * il vecchio tetto di 5s, Londra e Parigi sarebbero andate in timeout **sempre**.
 */
export const AREA_MASSIMA_KM2 = 900;

const metriPerGradoLon = (lat: number) => METRI_PER_GRADO_LAT * Math.cos((lat * Math.PI) / 180);

export function riquadroAttorno(punti: Punto[]): Riquadro {
  const lat = punti.map((p) => p.lat);
  const lon = punti.map((p) => p.lon);
  const sud = Math.min(...lat);
  const nord = Math.max(...lat);

  const margineLat = MARGINE_METRI / METRI_PER_GRADO_LAT;
  // Il grado di longitudine si accorcia verso i poli: si usa la latitudine più lontana
  // dall'equatore fra le due, così il margine in metri è garantito su entrambi i lati.
  const margineLon = MARGINE_METRI / metriPerGradoLon(Math.max(Math.abs(sud), Math.abs(nord)));

  return {
    sud: sud - margineLat,
    nord: nord + margineLat,
    ovest: Math.min(...lon) - margineLon,
    est: Math.max(...lon) + margineLon,
  };
}

export function areaKm2(r: Riquadro): number {
  const altezza = (r.nord - r.sud) * METRI_PER_GRADO_LAT;
  const larghezza = (r.est - r.ovest) * metriPerGradoLon((r.nord + r.sud) / 2);
  return (altezza * larghezza) / 1_000_000;
}

/** Le tappe che condividono un rettangolo, e quindi una sola interrogazione Overpass. */
export interface GruppoDiTappe<T> {
  punti: T[];
  riquadro: Riquadro;
}

/** Il quadrato della distanza in metri: basta a confrontare, e non paga una radice. */
function distanzaQuadrata(p: Punto, riferimento: Punto): number {
  const metriLon = metriPerGradoLon(riferimento.lat);
  return (
    ((p.lat - riferimento.lat) * METRI_PER_GRADO_LAT) ** 2 +
    ((p.lon - riferimento.lon) * metriLon) ** 2
  );
}

/**
 * Il rettangolo attorno a `riferimento`: si tengono le tappe che ci stanno dentro rispettando
 * il tetto d'area, si mettono da parte le altre. Finché il rettangolo sfora, si toglie la
 * tappa più lontana dal riferimento.
 *
 * Il riferimento è un punto dato da fuori e non una statistica ricavata dalle tappe (media,
 * mediana) perché con **due** tappe qualsiasi statistica cade a metà strada fra le due e le
 * rende equidistanti: il criterio non saprebbe quale escludere e ne caccerebbe una a caso,
 * potenzialmente quella in centro città. Il centro della destinazione, invece, dice qual è
 * la base del viaggio e quale la gita: è l'informazione che serve, e ce l'abbiamo già.
 */
function ritaglia<T extends Punto>(punti: T[], riferimento: Punto): { dentro: T[]; fuori: T[] } {
  const dentro = [...punti];
  const fuori: T[] = [];

  while (dentro.length > 1 && areaKm2(riquadroAttorno(dentro)) > AREA_MASSIMA_KM2) {
    let peggiore = 0;
    dentro.forEach((p, i) => {
      if (distanzaQuadrata(p, riferimento) > distanzaQuadrata(dentro[peggiore], riferimento)) peggiore = i;
    });
    fuori.push(dentro.splice(peggiore, 1)[0]);
  }

  return { dentro, fuori };
}

/**
 * Raggruppa le tappe in **rettangoli**, uno per interrogazione Overpass.
 *
 * Nel caso normale — un itinerario in una città sola — il gruppo è uno solo e la funzione
 * restituisce esattamente ciò che la funzionalità promette: una sola interrogazione per
 * tutto il viaggio. I gruppi successivi nascono solo quando ci sono tappe troppo lontane per
 * entrare nel primo rettangolo senza sfondare `AREA_MASSIMA_KM2`.
 *
 * **Perché un secondo rettangolo e non un'interrogazione per tappa lontana** (corretto il
 * 2026-08-26): fino a quel giorno chi restava fuori riceveva un `around` proprio, uno per
 * tappa. Sembrava il caso raro della gita isolata, ma non lo è: Napoli più la costiera —
 * sessanta chilometri, due grappoli distinti — espelle *tutte* le tappe del secondo
 * grappolo, una alla volta, e produce quattro o cinque richieste ravvicinate, cioè
 * esattamente il pattern che questa riscrittura esisteva per eliminare. Raggruppandole, quel
 * viaggio costa **due** interrogazioni invece di cinque, e il caso della gita davvero
 * isolata resta un rettangolo minimo di 1,6 km per lato (2,56 km²), che Overpass serve al
 * prezzo di un `around`.
 *
 * Il polo di ogni gruppo successivo è la tappa **più lontana** da quello precedente: è il
 * capo del grappolo remoto (Amalfi rispetto a Napoli), e prenderlo come centro tiene insieme
 * i suoi vicini invece di ritagliarli a fette. Il ciclo termina sempre perché ogni giro
 * consuma almeno una tappa: un punto solo produce un rettangolo sempre sotto il tetto.
 */
export function raggruppaPerRiquadri<T extends Punto>(
  punti: T[],
  riferimento: Punto
): GruppoDiTappe<T>[] {
  const gruppi: GruppoDiTappe<T>[] = [];
  let restanti = punti;
  let polo = riferimento;

  while (restanti.length > 0) {
    const { dentro, fuori } = ritaglia(restanti, polo);
    gruppi.push({ punti: dentro, riquadro: riquadroAttorno(dentro) });

    if (fuori.length > 0) {
      let piuLontana = fuori[0];
      for (const p of fuori) {
        if (distanzaQuadrata(p, polo) > distanzaQuadrata(piuLontana, polo)) piuLontana = p;
      }
      polo = piuLontana;
    }

    restanti = fuori;
  }

  return gruppi;
}
