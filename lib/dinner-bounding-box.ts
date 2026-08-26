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

/**
 * Separa le tappe che stanno nel rettangolo condiviso da quelle troppo lontane per
 * entrarci — la gita fuori porta, che da sola allargherebbe l'area a dismisura.
 *
 * Il criterio è iterativo e ha un solo parametro, il tetto d'area: finché il rettangolo
 * sfora, si toglie la tappa più lontana dal `riferimento` — il centro della destinazione —
 * e la si mette da parte.
 *
 * Il riferimento è il centro della destinazione e non una statistica ricavata dalle tappe
 * (media, mediana) perché con **due** tappe qualsiasi statistica cade a metà strada fra le
 * due e le rende equidistanti: il criterio non saprebbe quale escludere e ne caccerebbe una
 * a caso, potenzialmente quella in centro città. Il centro della destinazione, invece, dice
 * qual è la base del viaggio e quale la gita: è l'informazione che serve, e ce l'abbiamo già.
 *
 * Chi resta fuori non perde il consiglio: il chiamante gli dedica un'interrogazione `around`
 * propria, se il budget di tempo lo consente. Il ciclo non svuota mai l'elenco, perché un
 * punto solo produce un rettangolo di 1,6 km per lato, cioè 2,56 km², sempre sotto il tetto.
 */
export function dividiPerRiquadro<T extends Punto>(
  punti: T[],
  riferimento: Punto
): { dentro: T[]; fuori: T[]; riquadro: Riquadro | null } {
  if (punti.length === 0) return { dentro: [], fuori: [], riquadro: null };

  const dentro = [...punti];
  const fuori: T[] = [];
  const metriLon = metriPerGradoLon(riferimento.lat);
  const distanza = (p: Punto) =>
    ((p.lat - riferimento.lat) * METRI_PER_GRADO_LAT) ** 2 + ((p.lon - riferimento.lon) * metriLon) ** 2;

  while (dentro.length > 1 && areaKm2(riquadroAttorno(dentro)) > AREA_MASSIMA_KM2) {
    let peggiore = 0;
    dentro.forEach((p, i) => {
      if (distanza(p) > distanza(dentro[peggiore])) peggiore = i;
    });
    fuori.push(dentro.splice(peggiore, 1)[0]);
  }

  return { dentro, fuori, riquadro: riquadroAttorno(dentro) };
}
