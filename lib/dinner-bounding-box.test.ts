import { describe, expect, it } from "vitest";
import {
  AREA_MASSIMA_KM2,
  MARGINE_METRI,
  areaKm2,
  dividiPerRiquadro,
  riquadroAttorno,
} from "./dinner-bounding-box";

// Bologna, il punto su cui sono state fatte le misure vere del 2026-08-26.
const LAT = 44.4949;
const LON = 11.3426;

// Il centro della destinazione: il riferimento rispetto a cui si decide chi è la gita.
const CENTRO = { lat: LAT, lon: LON };

// Quanti gradi valgono N metri a questa latitudine: serve a costruire punti a distanza
// nota senza scrivere coordinate a caso.
const gradiLat = (metri: number) => metri / 111_320;
const gradiLon = (metri: number) => metri / (111_320 * Math.cos((LAT * Math.PI) / 180));

describe("riquadroAttorno", () => {
  it("racchiude tutti i punti", () => {
    const r = riquadroAttorno([
      { lat: LAT, lon: LON },
      { lat: LAT + gradiLat(3_000), lon: LON - gradiLon(2_000) },
    ]);

    expect(r.sud).toBeLessThan(LAT);
    expect(r.nord).toBeGreaterThan(LAT + gradiLat(3_000));
    expect(r.ovest).toBeLessThan(LON - gradiLon(2_000));
    expect(r.est).toBeGreaterThan(LON);
  });

  // Il margine non è decorativo: i candidati di ogni sera si scelgono entro
  // SEARCH_RADIUS_METERS (600 m) dalla tappa, quindi il rettangolo deve contenere per
  // intero il cerchio di ricerca di ogni tappa, anche di quelle sul bordo.
  it("aggiunge un margine più largo del raggio di ricerca su ogni lato", () => {
    const r = riquadroAttorno([{ lat: LAT, lon: LON }]);

    expect(MARGINE_METRI).toBeGreaterThan(600);
    expect((LAT - r.sud) * 111_320).toBeCloseTo(MARGINE_METRI, 0);
    expect((r.nord - LAT) * 111_320).toBeCloseTo(MARGINE_METRI, 0);
    expect((LON - r.ovest) * 111_320 * Math.cos((LAT * Math.PI) / 180)).toBeCloseTo(MARGINE_METRI, 0);
  });

  it("un punto solo dà un riquadro di lato pari al doppio del margine", () => {
    const r = riquadroAttorno([{ lat: LAT, lon: LON }]);
    expect(areaKm2(r)).toBeCloseTo(((2 * MARGINE_METRI) / 1_000) ** 2, 1);
  });
});

describe("dividiPerRiquadro", () => {
  it("tiene insieme le tappe di una città: un solo riquadro, nessuna esclusa", () => {
    // Le 14 tappe vere di Bologna misurate il 2026-08-26 danno 47,9 km² col margine:
    // molto sotto il tetto. Qui bastano quattro punti sparsi su ~6 km.
    const punti = [
      { lat: LAT, lon: LON },
      { lat: LAT + gradiLat(2_000), lon: LON + gradiLon(1_000) },
      { lat: LAT - gradiLat(1_500), lon: LON - gradiLon(4_000) },
      { lat: LAT + gradiLat(500), lon: LON + gradiLon(2_500) },
    ];

    const { dentro, fuori, riquadro } = dividiPerRiquadro(punti, CENTRO);

    expect(fuori).toEqual([]);
    expect(dentro).toHaveLength(4);
    expect(riquadro).not.toBeNull();
    expect(areaKm2(riquadro!)).toBeLessThan(AREA_MASSIMA_KM2);
  });

  // La gita fuori porta: una sola tappa lontanissima allargherebbe il rettangolo a
  // dismisura, e il costo di una risposta Overpass cresce con l'*area*, cioè col quadrato
  // del lato (misurato: 900 km² → 339 KB in 1,4 s; 40.000 km² → 3,3 MB in 27,3 s).
  it("esclude la tappa fuori porta invece di allargare il rettangolo", () => {
    const vicine = [
      { lat: LAT, lon: LON, nome: "a" },
      { lat: LAT + gradiLat(1_000), lon: LON, nome: "b" },
      { lat: LAT, lon: LON + gradiLon(1_000), nome: "c" },
    ];
    const lontana = { lat: LAT + gradiLat(80_000), lon: LON + gradiLon(80_000), nome: "gita" };

    const { dentro, fuori, riquadro } = dividiPerRiquadro([...vicine, lontana], CENTRO);

    expect(fuori.map((p) => p.nome)).toEqual(["gita"]);
    expect(dentro.map((p) => p.nome)).toEqual(["a", "b", "c"]);
    expect(areaKm2(riquadro!)).toBeLessThanOrEqual(AREA_MASSIMA_KM2);
  });

  it("esclude quante tappe servono, non solo la prima", () => {
    const vicine = [
      { lat: LAT, lon: LON, nome: "a" },
      { lat: LAT + gradiLat(1_000), lon: LON, nome: "b" },
    ];
    const lontane = [
      { lat: LAT + gradiLat(50_000), lon: LON + gradiLon(50_000), nome: "nordest" },
      { lat: LAT - gradiLat(50_000), lon: LON + gradiLon(50_000), nome: "sudest" },
    ];

    const { dentro, fuori, riquadro } = dividiPerRiquadro([...vicine, ...lontane], CENTRO);

    expect(fuori.map((p) => p.nome).sort()).toEqual(["nordest", "sudest"]);
    expect(dentro.map((p) => p.nome)).toEqual(["a", "b"]);
    expect(areaKm2(riquadro!)).toBeLessThanOrEqual(AREA_MASSIMA_KM2);
  });

  // Proprietà voluta del tetto sull'*area*, non sul lato: due tappe a 90 km l'una
  // dall'altra ma allineate danno una fascia di 90 x 1,6 km, cioè 144 km², che Overpass
  // serve al prezzo di una città. Spezzarla sarebbe pagare due interrogazioni per niente.
  it("non spezza una fascia lunga e stretta: è l'area a costare, non la distanza", () => {
    const { dentro, fuori } = dividiPerRiquadro(
      [
        { lat: LAT, lon: LON },
        { lat: LAT + gradiLat(90_000), lon: LON },
      ],
      CENTRO
    );

    expect(fuori).toEqual([]);
    expect(dentro).toHaveLength(2);
  });

  // Il caso che ha fatto scartare la mediana come riferimento: con due sole tappe qualsiasi
  // statistica ricavata da esse cade a metà strada e le rende equidistanti, così a essere
  // esclusa poteva essere quella in centro città. Il centro della destinazione non ha
  // questo problema.
  it("con due sole tappe esclude la gita, non quella in città", () => {
    const { dentro, fuori } = dividiPerRiquadro(
      [
        { lat: LAT, lon: LON, nome: "in città" },
        { lat: LAT + gradiLat(80_000), lon: LON + gradiLon(80_000), nome: "gita" },
      ],
      CENTRO
    );

    expect(dentro.map((p) => p.nome)).toEqual(["in città"]);
    expect(fuori.map((p) => p.nome)).toEqual(["gita"]);
  });

  it("conserva l'ordine delle tappe rimaste", () => {
    const punti = [
      { lat: LAT, lon: LON, nome: "1" },
      { lat: LAT + gradiLat(90_000), lon: LON + gradiLon(90_000), nome: "2" },
      { lat: LAT + gradiLat(300), lon: LON, nome: "3" },
    ];

    expect(dividiPerRiquadro(punti, CENTRO).dentro.map((p) => p.nome)).toEqual(["1", "3"]);
  });

  it("un elenco vuoto non produce nessun riquadro", () => {
    expect(dividiPerRiquadro([], CENTRO)).toEqual({ dentro: [], fuori: [], riquadro: null });
  });

  // Un punto solo non si può escludere: il riquadro minimo è il doppio del margine per
  // lato, quindi è sempre sotto il tetto e il ciclo deve fermarsi comunque.
  it("non svuota mai l'elenco: l'ultimo punto resta dentro", () => {
    const { dentro, fuori } = dividiPerRiquadro([{ lat: LAT, lon: LON }], CENTRO);
    expect(dentro).toHaveLength(1);
    expect(fuori).toEqual([]);
  });
});
