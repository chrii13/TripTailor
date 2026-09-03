import { describe, it, expect } from "vitest";
import type { DailyClimateAverage } from "./climate-forecast";
import { costruisciConsigliValigia } from "./consigli-valigia";

/**
 * Le giornate sono costruite a mano e non da una fixture condivisa: ogni caso
 * di prova qui esiste per un confine preciso, e una fixture comune finirebbe
 * per farli passare tutti per la stessa ragione.
 */
function giornata(
  tempMinAvg: number,
  tempMaxAvg: number,
  precipitationChance = 0
): DailyClimateAverage {
  return { date: "2026-05-20", tempMinAvg, tempMaxAvg, precipitationChance };
}

describe("costruisciConsigliValigia — assenza di dati", () => {
  it("senza clima non produce nulla", () => {
    expect(costruisciConsigliValigia(null)).toBeNull();
  });

  it("con un elenco vuoto non produce nulla", () => {
    expect(costruisciConsigliValigia([])).toBeNull();
  });
});

describe("costruisciConsigliValigia — fasce di temperatura", () => {
  it("una giornata sola basta: il viaggio minimo non è un caso limite da escludere", () => {
    const risultato = costruisciConsigliValigia([giornata(14, 18)]);
    expect(risultato).not.toBeNull();
    expect(risultato!.minima).toBe(14);
    expect(risultato!.massima).toBe(18);
    expect(risultato!.voci.join(" ")).toContain("Maglie a maniche lunghe");
    // Minima e massima cadono nella stessa fascia, quindi il capo viene aggiunto
    // due volte e a tenerlo unico è solo il Set: senza questo assert, sostituire
    // il Set con un array lascerebbe la suite verde e la lista ripetuta.
    expect(risultato!.voci).toHaveLength(new Set(risultato!.voci).size);
  });

  it("due fasce adiacenti non ripetono lo stesso consiglio", () => {
    // Minima 15° e massima 22° è il viaggio più comune che esista, non un estremo:
    // fa scattare 13-19 e 20-26 insieme. Il caso a fasce lontane (3°/22°) non
    // copre questo, perché quelle due voci non si somigliano abbastanza da
    // ripetersi. Qui invece si somigliavano, e il Set non poteva accorgersene.
    const risultato = costruisciConsigliValigia([giornata(15, 22)]);
    const testo = risultato!.voci.join(" ");
    expect(testo).toContain("Maglie a maniche lunghe");
    expect(testo).toContain("Abbigliamento leggero");
    expect(testo.match(/per la sera/g)).toHaveLength(1);
  });

  it("12 e 13 gradi cadono in due fasce diverse", () => {
    const dodici = costruisciConsigliValigia([giornata(12, 12)]);
    const tredici = costruisciConsigliValigia([giornata(13, 13)]);
    expect(dodici!.voci.join(" ")).toContain("giacca calda");
    expect(tredici!.voci.join(" ")).not.toContain("giacca calda");
    expect(tredici!.voci.join(" ")).toContain("Maglie a maniche lunghe");
  });

  it("4 e 5 gradi cadono in due fasce diverse", () => {
    const quattro = costruisciConsigliValigia([giornata(4, 4)]);
    const cinque = costruisciConsigliValigia([giornata(5, 5)]);
    expect(quattro!.voci.join(" ")).toContain("cappotto pesante");
    expect(cinque!.voci.join(" ")).not.toContain("cappotto pesante");
    expect(cinque!.voci.join(" ")).toContain("giacca calda");
  });

  it("19 e 20 gradi cadono in due fasce diverse", () => {
    const diciannove = costruisciConsigliValigia([giornata(19, 19)]);
    const venti = costruisciConsigliValigia([giornata(20, 20)]);
    expect(diciannove!.voci.join(" ")).toContain("Maglie a maniche lunghe");
    expect(diciannove!.voci.join(" ")).not.toContain("Abbigliamento leggero");
    expect(venti!.voci.join(" ")).toContain("Abbigliamento leggero");
    expect(venti!.voci.join(" ")).not.toContain("Maglie a maniche lunghe");
  });

  it("26 e 27 gradi cadono in due fasce diverse", () => {
    const ventisei = costruisciConsigliValigia([giornata(26, 26)]);
    const ventisette = costruisciConsigliValigia([giornata(27, 27)]);
    expect(ventisei!.voci.join(" ")).not.toContain("protezione solare");
    expect(ventisette!.voci.join(" ")).toContain("protezione solare");
  });

  it("un viaggio che va dal freddo al caldo fa scattare entrambe le fasce", () => {
    // Minima 3° e massima 22°: è la montagna a primavera, non un'eccezione strana.
    // La lista deve coprire i due estremi, non una media che non descrive nessuna
    // giornata reale.
    const risultato = costruisciConsigliValigia([giornata(3, 8), giornata(15, 22)]);
    const testo = risultato!.voci.join(" ");
    expect(testo).toContain("cappotto pesante");
    expect(testo).toContain("Abbigliamento leggero");
  });
});

describe("costruisciConsigliValigia — escursione", () => {
  // Si cerca la voce per come **comincia**, non per un frammento contenuto: un
  // marcatore deve identificare la voce dell'escursione, non capitare dentro
  // un'altra. Cercare "a strati" dentro le voci unite ha già dato un falso rosso
  // quando la fascia 5-12 nominava gli strati a sua volta, e un frammento tornato
  // ambiguo per una modifica futura al copy lascerebbe il test verde e inutile.
  // "In media" è l'unico incipit che non nomina un capo, quindi è univoco.
  it("dieci gradi esatti non fanno scattare gli strati", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 20)]);
    expect(risultato!.voci.some((v) => v.startsWith("In media"))).toBe(false);
  });

  it("undici gradi sì, e la differenza è detta in cifre", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 21)]);
    const strati = risultato!.voci.find((v) => v.startsWith("In media"));
    expect(strati).toBeDefined();
    expect(strati).toContain("11");
  });
});

describe("costruisciConsigliValigia — pioggia", () => {
  it("il trenta per cento esatto non basta", () => {
    const risultato = costruisciConsigliValigia([giornata(15, 20, 30)]);
    expect(risultato!.voci.join(" ")).not.toContain("impermeabile");
  });

  it("sopra il trenta per cento arriva la giacca impermeabile", () => {
    const risultato = costruisciConsigliValigia([giornata(15, 20, 31)]);
    expect(risultato!.voci.join(" ")).toContain("impermeabile");
  });

  it("con più della metà delle giornate piovose arrivano anche le scarpe", () => {
    const risultato = costruisciConsigliValigia([
      giornata(15, 20, 50),
      giornata(15, 20, 50),
      giornata(15, 20, 0),
    ]);
    expect(risultato!.voci.join(" ")).toContain("tengano l'acqua");
  });

  it("una giornata sola e piovosa fa scattare anche le scarpe", () => {
    // Una su una è più della metà: è l'unico modo in cui la soglia delle scarpe
    // scatta su un viaggio di un giorno solo, e l'altro test a giornata singola
    // ha pioggia a zero, quindi non passa mai di qui.
    const testo = costruisciConsigliValigia([giornata(15, 20, 60)])!.voci.join(" ");
    expect(testo).toContain("impermeabile");
    expect(testo).toContain("tengano l'acqua");
  });

  it("esattamente metà delle giornate non basta per le scarpe", () => {
    // Due su quattro è metà, non "più della metà": la soglia è stretta anche qui,
    // altrimenti su un numero pari di giornate scatterebbe con la metà esatta.
    const risultato = costruisciConsigliValigia([
      giornata(15, 20, 50),
      giornata(15, 20, 50),
      giornata(15, 20, 0),
      giornata(15, 20, 0),
    ]);
    const testo = risultato!.voci.join(" ");
    expect(testo).toContain("impermeabile");
    expect(testo).not.toContain("tengano l'acqua");
  });
});
