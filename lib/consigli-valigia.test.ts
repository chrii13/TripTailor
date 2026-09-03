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
    // "Maglie a maniche lunghe" e non il solo "maniche lunghe": quel frammento
    // vive anche nella fascia 20-26, e userebbe la stessa parola per due fasce
    // diverse — cioè non distinguerebbe ciò che il test esiste per distinguere.
    expect(risultato!.voci.join(" ")).toContain("Maglie a maniche lunghe");
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
  it("dieci gradi esatti non fanno scattare gli strati", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 20)]);
    expect(risultato!.voci.some((v) => v.startsWith("Vestiti"))).toBe(false);
  });

  it("undici gradi sì, e la differenza è detta in cifre", () => {
    const risultato = costruisciConsigliValigia([giornata(10, 21)]);
    const strati = risultato!.voci.find((v) => v.startsWith("Vestiti a strati"));
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
