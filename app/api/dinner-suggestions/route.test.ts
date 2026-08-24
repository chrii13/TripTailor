import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

// Gemini è simulato a livello di SDK, come in generate-itinerary/route.test.ts. LocationIQ
// e Overpass sono simulati a livello di `fetch`, così restano vere sia la geocodifica sia
// la lettura della risposta Overpass (ordinamento per distanza e numerazione da 1).
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

// Il centro della destinazione e il punto della tappa coincidono: le distanze dei
// candidati sono così calcolate da un punto noto e restano prevedibili.
const CENTRO = { lat: 41.9, lon: 12.5 };

const RISPOSTA_LOCATIONIQ = [
  { lat: String(CENTRO.lat), lon: String(CENTRO.lon), address: { city: "Roma", country_code: "it" } },
];

// Due locali: il primo esattamente sul punto (distanza 0), il secondo a circa mezzo
// chilometro. Ordinati per distanza diventano gli identificativi 1 e 2.
const RISPOSTA_OVERPASS = {
  elements: [
    {
      lat: 41.9,
      lon: 12.506,
      tags: { name: "Trattoria Lontana", "addr:street": "Via Lontana", opening_hours: "Mo-Su 19:00-23:00" },
    },
    {
      lat: 41.9,
      lon: 12.5,
      tags: { name: "Osteria Vicina", cuisine: "italian", "addr:street": "Via Vicina" },
    },
  ],
};

let rispostaLocationIq: unknown = RISPOSTA_LOCATIONIQ;
let rispostaLocationIqTappa: unknown = RISPOSTA_LOCATIONIQ;
let rispostaOverpass: unknown = RISPOSTA_OVERPASS;

// Quanto "invecchia" l'orologio a ogni chiamata di rete. A zero il tempo non conta e i
// test si comportano come se la fase fosse istantanea; alzandolo si simulano servizi lenti
// senza far durare davvero il test (vedi il test sul tetto della fase di ricerca).
let avanzamentoPerChiamataMs = 0;
let scartoOrologioMs = 0;

const fetchMock = vi.fn(async (input: unknown) => {
  scartoOrologioMs += avanzamentoPerChiamataMs;
  const url = String(input);
  const corpo = url.includes("overpass")
    ? rispostaOverpass
    : url.includes("bounded=1")
      ? rispostaLocationIqTappa
      : rispostaLocationIq;

  return { ok: true, status: 200, json: async () => corpo } as unknown as Response;
});

const CHIAVI_ORIGINALI = {
  gemini: process.env.GEMINI_API_KEY,
  backup: process.env.GEMINI_API_KEY_BACKUP,
  locationiq: process.env.LOCATIONIQ_API_KEY,
};

const corpoValido = {
  destination: "Roma",
  participants: [{ type: "adulto", age: 35 }],
  budget: 1200,
  styleNotes: "Cucina locale",
  days: [{ date: "2026-09-10", anchorTitle: "Colosseo" }],
};

function richiesta(body: unknown) {
  return new Request("http://localhost/api/dinner-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rispostaGemini(text: string) {
  return { text, candidates: [{ finishReason: "STOP" }] };
}

beforeEach(() => {
  generateContent.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  rispostaLocationIq = RISPOSTA_LOCATIONIQ;
  rispostaLocationIqTappa = RISPOSTA_LOCATIONIQ;
  rispostaOverpass = RISPOSTA_OVERPASS;
  avanzamentoPerChiamataMs = 0;
  scartoOrologioMs = 0;
  // Si sposta solo la lettura dell'orologio, non i timer: `AbortSignal.timeout`, usato
  // dalle chiamate di rete vere, continua a lavorare sul tempo reale.
  const adesso = Date.now.bind(Date);
  vi.spyOn(Date, "now").mockImplementation(() => adesso() + scartoOrologioMs);
  process.env.GEMINI_API_KEY = "chiave-di-prova";
  delete process.env.GEMINI_API_KEY_BACKUP;
  process.env.LOCATIONIQ_API_KEY = "chiave-locationiq";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const [chiave, valore] of [
    ["GEMINI_API_KEY", CHIAVI_ORIGINALI.gemini],
    ["GEMINI_API_KEY_BACKUP", CHIAVI_ORIGINALI.backup],
    ["LOCATIONIQ_API_KEY", CHIAVI_ORIGINALI.locationiq],
  ] as const) {
    if (valore === undefined) delete process.env[chiave];
    else process.env[chiave] = valore;
  }
});

describe("POST /api/dinner-suggestions", () => {
  it("rifiuta un corpo non valido con 400 senza chiamare il modello", async () => {
    const response = await POST(richiesta({ destination: "" }));

    expect(response.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rifiuta un corpo JSON malformato con 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/dinner-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "non è json{",
      })
    );

    expect(response.status).toBe(400);
  });

  it("risponde 200 con un elenco vuoto quando la destinazione non si geocodifica", async () => {
    rispostaLocationIq = [];

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("risponde 200 con un elenco vuoto quando nessuna giornata ha candidati", async () => {
    rispostaOverpass = { elements: [] };

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("risponde 200 con un elenco vuoto quando il modello fallisce", async () => {
    generateContent.mockRejectedValue(new Error("modello non raggiungibile"));

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("risponde 200 con un elenco vuoto quando il modello restituisce un JSON non valido", async () => {
    generateContent.mockResolvedValue(rispostaGemini("{ questo non è json"));

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("omette la giornata la cui scelta indica un identificativo fuori elenco", async () => {
    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({ days: [{ date: "2026-09-10", chosenId: 99, comment: "Un posto inventato." }] })
      )
    );

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("omette la giornata la cui data non corrisponde a nessuna richiesta", async () => {
    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({ days: [{ date: "2026-12-31", chosenId: 1, comment: "Giornata inesistente." }] })
      )
    );

    const response = await POST(richiesta(corpoValido));

    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("prende nome, via, distanza e orari dai candidati OSM e dal modello solo il commento", async () => {
    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({
          days: [{ date: "2026-09-10", chosenId: 2, comment: "Cucina di quartiere a due passi." }],
        })
      )
    );

    const response = await POST(richiesta(corpoValido));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggestions).toHaveLength(1);

    const [consiglio] = body.suggestions;
    // L'identificativo 2 è il locale più lontano: nome, via, orari e distanza vengono da OSM.
    expect(consiglio.date).toBe("2026-09-10");
    expect(consiglio.name).toBe("Trattoria Lontana");
    expect(consiglio.street).toBe("Via Lontana");
    expect(consiglio.openingHours).toBe("Mo-Su 19:00-23:00");
    expect(consiglio.distanceMeters).toBeGreaterThan(400);
    expect(consiglio.distanceMeters).toBeLessThan(600);
    expect(consiglio.comment).toBe("Cucina di quartiere a due passi.");
  });

  it("ripiega sulle coordinate della destinazione quando la geocodifica della tappa fallisce", async () => {
    rispostaLocationIqTappa = [];
    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({ days: [{ date: "2026-09-10", chosenId: 1, comment: "Sotto casa." }] })
      )
    );

    const response = await POST(richiesta(corpoValido));
    const body = await response.json();

    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].name).toBe("Osteria Vicina");
    // Le distanze sono calcolate dal centro della destinazione, non da un punto inventato.
    expect(body.suggestions[0].distanceMeters).toBe(0);
  });

  it("tiene una sola cena per sera quando il modello propone due scelte per la stessa data", async () => {
    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({
          days: [
            { date: "2026-09-10", chosenId: 1, comment: "La prima scelta." },
            { date: "2026-09-10", chosenId: 2, comment: "Un ripensamento." },
          ],
        })
      )
    );

    const response = await POST(richiesta(corpoValido));
    const body = await response.json();

    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].name).toBe("Osteria Vicina");
    expect(body.suggestions[0].comment).toBe("La prima scelta.");
  });

  it("interrompe la ricerca dei candidati al tetto di fase e lascia le ultime giornate senza consiglio", async () => {
    // Ogni chiamata di rete fa invecchiare l'orologio di 3 secondi: la geocodifica della
    // destinazione più il primo gruppo di quattro giornate (due chiamate l'una) superano
    // da soli il tetto di 20 secondi, e il secondo gruppo non parte nemmeno.
    avanzamentoPerChiamataMs = 3_000;

    const giornate = ["10", "11", "12", "13", "14", "15"].map((giorno) => ({
      date: `2026-09-${giorno}`,
      anchorTitle: `Tappa del ${giorno}`,
    }));

    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({
          days: giornate.map((g) => ({ date: g.date, chosenId: 1, comment: "Un consiglio." })),
        })
      )
    );

    const response = await POST(richiesta({ ...corpoValido, days: giornate }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggestions).toHaveLength(4);
    expect(body.suggestions.map((s: { date: string }) => s.date)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("risponde 200 con un elenco vuoto quando manca la chiave del modello", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });
});
