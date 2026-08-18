import { describe, it, expect } from "vitest";
import { buildCreaHref, decodeCreaPrefill } from "./crea-query-params";

describe("buildCreaHref", () => {
  it("costruisce un link con tutti i parametri", () => {
    const href = buildCreaHref({
      destination: "Lisbona, Portogallo",
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 5),
      budget: 1500,
      participants: [
        { type: "adulto", age: 30 },
        { type: "bambino", age: 7 },
      ],
    });

    expect(href.startsWith("/crea?")).toBe(true);
    const params = new URLSearchParams(href.slice("/crea?".length));
    expect(params.get("destination")).toBe("Lisbona, Portogallo");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("to")).toBe("2026-09-05");
    expect(params.get("budget")).toBe("1500");
    expect(params.get("p")).toBe("adulto:30,bambino:7");
  });

  it("omette i parametri assenti", () => {
    const href = buildCreaHref({ destination: "Roma" });
    const params = new URLSearchParams(href.slice("/crea?".length));
    expect(params.get("destination")).toBe("Roma");
    expect(params.get("budget")).toBeNull();
    expect(params.get("p")).toBeNull();
  });
});

describe("decodeCreaPrefill", () => {
  it("fa il percorso inverso di buildCreaHref", () => {
    const prefill = {
      destination: "Lisbona, Portogallo",
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 5),
      budget: 1500,
      participants: [{ type: "adulto" as const, age: 30 }],
    };
    const params = Object.fromEntries(
      new URLSearchParams(buildCreaHref(prefill).slice("/crea?".length))
    );

    const decoded = decodeCreaPrefill(params);

    expect(decoded.destination).toBe("Lisbona, Portogallo");
    expect(decoded.budget).toBe(1500);
    expect(decoded.participants).toEqual([{ type: "adulto", age: 30 }]);
    expect(decoded.from?.getFullYear()).toBe(2026);
    expect(decoded.from?.getMonth()).toBe(8);
    expect(decoded.from?.getDate()).toBe(1);
  });

  it("restituisce un oggetto vuoto quando non c'è alcun parametro", () => {
    expect(decodeCreaPrefill({})).toEqual({});
  });

  it("ignora una data malformata invece di produrre una data non valida", () => {
    const decoded = decodeCreaPrefill({ from: "non-una-data", to: "2026-09-05" });
    expect(decoded.from).toBeUndefined();
    expect(decoded.to).toBeDefined();
  });

  it("ignora un budget non numerico", () => {
    expect(decodeCreaPrefill({ budget: "tanti soldi" }).budget).toBeUndefined();
  });

  it("ignora un budget negativo", () => {
    expect(decodeCreaPrefill({ budget: "-100" }).budget).toBeUndefined();
  });

  it("decodifica più partecipanti", () => {
    const decoded = decodeCreaPrefill({ p: "adulto:30,bambino:7,ragazzo:20" });
    expect(decoded.participants).toEqual([
      { type: "adulto", age: 30 },
      { type: "bambino", age: 7 },
      { type: "ragazzo", age: 20 },
    ]);
  });

  it("scarta l'intero elenco se un tipo di partecipante non esiste", () => {
    expect(decodeCreaPrefill({ p: "adulto:30,cane:4" }).participants).toBeUndefined();
  });

  it("scarta l'intero elenco se un'età è fuori dalla fascia del suo tipo", () => {
    expect(decodeCreaPrefill({ p: "adulto:30,bambino:40" }).participants).toBeUndefined();
  });

  it("scarta l'intero elenco se un'età non è un numero", () => {
    expect(decodeCreaPrefill({ p: "adulto:trenta" }).participants).toBeUndefined();
  });

  it("scarta un elenco di partecipanti vuoto", () => {
    expect(decodeCreaPrefill({ p: "" }).participants).toBeUndefined();
  });

  it("ignora una destinazione composta solo da spazi", () => {
    expect(decodeCreaPrefill({ destination: "   " }).destination).toBeUndefined();
  });

  it("ignora un budget composto solo da spazi invece di convertirlo a 0", () => {
    expect(decodeCreaPrefill({ budget: "   " }).budget).toBeUndefined();
  });

  it("ignora un budget in notazione esadecimale", () => {
    expect(decodeCreaPrefill({ budget: "0x10" }).budget).toBeUndefined();
  });

  it("ignora un budget in notazione scientifica", () => {
    expect(decodeCreaPrefill({ budget: "1e3" }).budget).toBeUndefined();
  });

  it("scarta l'intero elenco se un'età è in notazione scientifica", () => {
    expect(decodeCreaPrefill({ p: "adulto:3e1" }).participants).toBeUndefined();
  });

  it("scarta l'intero elenco se un chunk di partecipante contiene più di un colon", () => {
    expect(decodeCreaPrefill({ p: "adulto:30:garbage" }).participants).toBeUndefined();
  });
});
