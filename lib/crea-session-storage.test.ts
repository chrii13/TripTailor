// Europe/Rome e non UTC: la sessione salvata contiene date di viaggio, che
// JSON.stringify serializza come istanti UTC. Con TZ=UTC un eventuale slittamento
// di un giorno non si vedrebbe e il test non proteggerebbe nulla.
process.env.TZ = "Europe/Rome";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadCreaSession, saveCreaSession, type CreaSession } from "@/lib/crea-session-storage";

const CHIAVE = "crea-itinerary-session";

/** sessionStorage in memoria: l'ambiente node dei test non ne ha uno. */
function fakeStorage() {
  const dati = new Map<string, string>();
  return {
    getItem: (key: string) => dati.get(key) ?? null,
    setItem: (key: string, value: string) => {
      dati.set(key, value);
    },
    removeItem: (key: string) => {
      dati.delete(key);
    },
    clear: () => dati.clear(),
  };
}

const SESSIONE: CreaSession = {
  mode: "result",
  submitted: {
    destination: "Roma, Italia",
    dateRange: { from: new Date(2026, 4, 20), to: new Date(2026, 4, 21) },
    participants: [{ type: "adulto", age: 30 }],
    budget: 1200,
    styleNotes: "",
    mustSee: "",
    arrivalTime: "",
    departureTime: "",
  },
  itinerary: {
    days: [
      {
        date: "2026-05-20",
        mattina: [
          {
            title: "Colosseo",
            description: "Visita guidata dell'anfiteatro.",
            estimatedCost: "18€",
            suggestedTime: "09:00 - 11:00",
            details: { about: "", gettingThere: "", tips: "" },
          },
        ],
        pomeriggio: [],
        sera: [],
      },
      { date: "2026-05-21", mattina: [], pomeriggio: [], sera: [] },
    ],
  },
  weather: [{ date: "2026-05-20", tempMaxAvg: 24, tempMinAvg: 14, precipitationChance: 10 }],
  countryInfo: {
    name: "Italia",
    code: "IT",
    currency: { code: "EUR", symbol: "€", name: "Euro" },
    languages: ["Italiano"],
    timezones: ["UTC+02:00"],
  },
  dinner: [
    {
      date: "2026-05-20",
      name: "Trattoria da Enzo",
      comment: "A due passi dall'ultima tappa.",
      distanceMeters: 180,
      lat: 41.889,
      lon: 12.492,
      street: "Via dei Vascellari 29",
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal("sessionStorage", fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crea-session-storage — andata e ritorno", () => {
  it("restituisce intera la sessione salvata", () => {
    saveCreaSession(SESSIONE);
    const letta = loadCreaSession();

    expect(letta).not.toBeNull();
    expect(letta!.mode).toBe("result");
    expect(letta!.submitted.destination).toBe("Roma, Italia");
    // Le date tornano come oggetti Date, non come stringhe, e sullo stesso
    // dispositivo indicano lo stesso giorno di calendario.
    expect(letta!.submitted.dateRange.from).toBeInstanceOf(Date);
    expect(letta!.submitted.dateRange.from!.getTime()).toBe(new Date(2026, 4, 20).getTime());
    expect(letta!.submitted.dateRange.to!.getDate()).toBe(21);
    expect(letta!.itinerary.days).toHaveLength(2);
    expect(letta!.itinerary.days[0].mattina[0].title).toBe("Colosseo");
    expect(letta!.weather).toHaveLength(1);
    expect(letta!.countryInfo?.currency.symbol).toBe("€");
    // I consigli sulla cena sopravvivono: sono costati una seconda chiamata di rete.
    expect(letta!.dinner).toHaveLength(1);
    expect(letta!.dinner![0].name).toBe("Trattoria da Enzo");
  });

  it("conserva il modo «form», così chi ha premuto Modifica non torna sul risultato", () => {
    saveCreaSession({ ...SESSIONE, mode: "form" });
    expect(loadCreaSession()?.mode).toBe("form");
  });

  it("senza niente in memoria restituisce null", () => {
    expect(loadCreaSession()).toBeNull();
  });
});

describe("crea-session-storage — contenuto non valido", () => {
  it("scarta un JSON non parsabile", () => {
    sessionStorage.setItem(CHIAVE, "{non-json");
    expect(loadCreaSession()).toBeNull();
  });

  it("scarta una sessione con un campo mancante", () => {
    const senzaItinerario = { ...SESSIONE, itinerary: undefined };
    sessionStorage.setItem(CHIAVE, JSON.stringify(senzaItinerario));
    expect(loadCreaSession()).toBeNull();
  });

  it("scarta una sessione con un campo del tipo sbagliato", () => {
    const budgetSbagliato = {
      ...SESSIONE,
      submitted: { ...SESSIONE.submitted, budget: "molti soldi" },
    };
    sessionStorage.setItem(CHIAVE, JSON.stringify(budgetSbagliato));
    expect(loadCreaSession()).toBeNull();
  });

  it("scarta un modo che non esiste", () => {
    sessionStorage.setItem(CHIAVE, JSON.stringify({ ...SESSIONE, mode: "risultato" }));
    expect(loadCreaSession()).toBeNull();
  });

  it("scarta un consiglio sulla cena malformato senza far cadere il resto", () => {
    const cenaSbagliata = { ...SESSIONE, dinner: [null] };
    sessionStorage.setItem(CHIAVE, JSON.stringify(cenaSbagliata));
    expect(loadCreaSession()).toBeNull();
  });
});

describe("crea-session-storage — sessionStorage indisponibile", () => {
  it("non propaga l'eccezione in scrittura (navigazione privata)", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(() => saveCreaSession(SESSIONE)).not.toThrow();
  });

  it("non propaga l'eccezione in lettura", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    });

    expect(loadCreaSession()).toBeNull();
  });
});
