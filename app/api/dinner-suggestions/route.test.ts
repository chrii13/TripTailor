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

// Il distanziamento fra le chiamate ai servizi esterni è vero solo in produzione: qui
// aspettare davvero un secondo per gruppo costerebbe secondi di suite per non verificare
// nulla. Si sostituisce **solo l'attesa**, non il calcolo: `finestraScorrevole` resta
// quella vera, quindi i millisecondi che arrivano qui sono quelli veri e i test possono
// asserirli. Sostituire la finestra intera renderebbe i test ciechi proprio sul valore.
const { attendi, registro } = vi.hoisted(() => {
  const registro: string[] = [];
  return {
    registro,
    attendi: vi.fn<(ms: number) => Promise<void>>(async (ms) => {
      registro.push(`attesa:${Math.round(ms)}`);
    }),
  };
});
vi.mock("@/lib/attesa", () => ({ attendi }));

// La finestra di distanziamento, in millisecondi: lo stesso valore che la route usa per
// LocationIQ e per Overpass. Se là cambia, questi test devono cambiare con lui — è il
// punto: prima asserivano solo che *un* numero fosse passato, e portare la finestra a zero
// li lasciava verdi.
const FINESTRA_MS = 1_000;

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

// Le due risposte simulate possono essere un valore fisso oppure una funzione della
// richiesta: serve ai test in cui le tappe stanno in punti diversi (la gita fuori porta) o
// in cui conta distinguere l'interrogazione sul rettangolo da quella attorno a un punto.
type Simulata<T = string> = unknown | ((richiesta: T) => unknown);
const risolvi = <T,>(v: Simulata<T>, richiesta: T) =>
  typeof v === "function" ? (v as (r: T) => unknown)(richiesta) : v;

let rispostaLocationIq: Simulata = RISPOSTA_LOCATIONIQ;
let rispostaLocationIqTappa: Simulata = RISPOSTA_LOCATIONIQ;
let rispostaOverpass: Simulata = RISPOSTA_OVERPASS;

// Una tappa a ~70 km dal centro: abbastanza per non entrare nel rettangolo comune.
const LONTANO = { lat: CENTRO.lat + 0.7, lon: CENTRO.lon + 0.7 };

/**
 * Il rettangolo interrogato contiene quel punto? Dal 2026-08-26 anche le tappe lontane
 * viaggiano in un rettangolo, quindi non basta più cercare `around:` per distinguere le due
 * interrogazioni: si legge il riquadro dalla query e si guarda chi ci sta dentro.
 */
const contiene = (query: string, p: { lat: number; lon: number }) => {
  const m = query.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
  if (!m) return false;
  const [sud, ovest, nord, est] = m.slice(1).map(Number);
  return p.lat >= sud && p.lat <= nord && p.lon >= ovest && p.lon <= est;
};

/** Le sole interrogazioni Overpass fatte, nel testo che è davvero partito. */
const interrogazioniOverpass = () =>
  fetchMock.mock.calls
    .filter(([input]) => String(input).includes("overpass"))
    .map(([, init]) => String((init as { body: URLSearchParams }).body.get("data")));

// Quanto "invecchia" l'orologio a ogni chiamata di rete. A zero il tempo non conta e i
// test si comportano come se la fase fosse istantanea; alzandolo si simulano servizi lenti
// senza far durare davvero il test (vedi il test sul tetto della fase di ricerca).
let avanzamentoPerChiamataMs = 0;
let scartoOrologioMs = 0;

const fetchMock = vi.fn(async (input: unknown, init?: unknown) => {
  scartoOrologioMs += avanzamentoPerChiamataMs;
  const url = String(input);
  registro.push(url.includes("overpass") ? "overpass" : "geocodifica");
  const corpo = url.includes("overpass")
    ? risolvi(rispostaOverpass, String((init as { body: URLSearchParams }).body.get("data")))
    : url.includes("bounded=1")
      ? risolvi(rispostaLocationIqTappa, url)
      : risolvi(rispostaLocationIq, url);

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
  attendi.mockClear();
  fetchMock.mockClear();
  registro.length = 0;
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

  // Il test che vale il lavoro del 2026-08-26. Fino ad allora ogni sera aveva la propria
  // interrogazione Overpass: la fase si esauriva attorno alla sesta e un viaggio di due
  // settimane riceveva sei consigli, non quattordici. Se qualcuno rimettesse una
  // interrogazione per giornata, il conteggio qui sotto salirebbe a quattordici.
  it("interroga Overpass una volta sola e consiglia tutte le sere di un viaggio di due settimane", async () => {
    const giornate = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-09-${String(10 + i).padStart(2, "0")}`,
      anchorTitle: `Tappa ${i + 1}`,
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
    expect(interrogazioniOverpass()).toHaveLength(1);
    expect(body.suggestions).toHaveLength(14);
  });

  it("interroga un rettangolo, non un raggio, quando le tappe stanno insieme", async () => {
    generateContent.mockResolvedValue(
      rispostaGemini(JSON.stringify({ days: [{ date: "2026-09-10", chosenId: 1, comment: "Ok." }] }))
    );

    await POST(richiesta(corpoValido));

    const [query] = interrogazioniOverpass();
    expect(query).not.toContain("around:");
    expect(query).toMatch(/\(-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+\)/);
  });

  // Senza la pausa, LocationIQ (2 richieste al secondo) rifiuta: misurate 10 risposte 429
  // su 14 tappe. Prima del 2026-08-26 il distanziatore era la chiamata a Overpass che
  // seguiva ogni giornata; tolta quella, la pausa va messa a mano.
  it("distanzia i gruppi di geocodifica: LocationIQ regge due richieste al secondo", async () => {
    generateContent.mockResolvedValue(rispostaGemini(JSON.stringify({ days: [] })));

    const giornate = ["10", "11", "12", "13"].map((giorno) => ({
      date: `2026-09-${giorno}`,
      anchorTitle: `Tappa del ${giorno}`,
    }));

    await POST(richiesta({ ...corpoValido, days: giornate }));

    // Quattro giornate, due gruppi, un'attesa in apertura di ciascuno. I **millisecondi**
    // vanno asseriti, non solo il fatto che l'attesa ci sia: fino al 2026-08-26 questo test
    // asseriva `typeof ms === "number"`, e restava verde anche portando la finestra a zero,
    // cioè con la protezione disattivata. Le chiamate qui sotto non passano mai per una rete
    // vera, quindi l'orologio avanza di pochissimo e l'attesa residua è quasi tutto
    // l'intervallo: la tolleranza copre quei pochi millisecondi reali.
    const attese = attendi.mock.calls.map(([ms]) => ms);
    expect(attese).toHaveLength(2);
    for (const ms of attese) {
      expect(ms).toBeGreaterThan(FINESTRA_MS - 100);
      expect(ms).toBeLessThanOrEqual(FINESTRA_MS);
    }
  });

  // L'altro dettaglio fragile della finestra, e finora non pinnato da niente: **da quando**
  // si conta. La geocodifica della destinazione è una richiesta LocationIQ come le altre, e
  // se la finestra partisse dopo di lei il primo gruppo ne farebbe tre nello stesso secondo
  // — che nella prova sul campo del 2026-08-26 era l'unico `429` rimasto. Qui la
  // destinazione consuma 600 ms dei 1000 della finestra: al primo gruppo ne devono restare
  // ~400. Spostando la riga della finestra dopo la geocodifica, l'attesa torna a ~1000 e
  // questo test diventa rosso.
  it("la finestra parte dalla geocodifica della destinazione, non dal primo gruppo", async () => {
    avanzamentoPerChiamataMs = 600;
    generateContent.mockResolvedValue(rispostaGemini(JSON.stringify({ days: [] })));

    await POST(richiesta(corpoValido));

    const [primaAttesa] = attendi.mock.calls.map(([ms]) => ms);
    expect(primaAttesa).toBeGreaterThan(FINESTRA_MS - 600 - 100);
    expect(primaAttesa).toBeLessThanOrEqual(FINESTRA_MS - 600);
  });

  it("interrompe la geocodifica al tetto di fase e lascia le ultime giornate senza consiglio", async () => {
    // Ogni chiamata di rete fa invecchiare l'orologio di 6 secondi, e le conta tutte, anche
    // quelle che nella route partono insieme (l'orologio qui è finto: il parallelismo non
    // fa risparmiare tempo). Un gruppo di due giornate costa quindi 12 secondi. Il tetto
    // della geocodifica è 20s e si controlla con l'anticipo di una geocodifica intera
    // (2,5s): dopo i 6s della destinazione il primo gruppo passa (6 + 2,5 ≤ 20) e finisce a
    // 18, il secondo no (18 + 2,5 > 20). Restano due giornate su sei.
    avanzamentoPerChiamataMs = 6_000;

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
    expect(body.suggestions.map((s: { date: string }) => s.date)).toEqual([
      "2026-09-10",
      "2026-09-11",
    ]);
  });

  // La gita fuori porta: una tappa a decine di chilometri allargherebbe il rettangolo a
  // dismisura, e il costo di una risposta cresce con l'area. Le si dedica un rettangolo
  // proprio (1,6 km per lato) invece di far pagare a tutti la sua distanza.
  it("dedica un rettangolo proprio alla tappa troppo lontana per quello comune", async () => {
    rispostaLocationIqTappa = (url: string) =>
      url.includes("Gita") ? [{ lat: String(LONTANO.lat), lon: String(LONTANO.lon) }] : RISPOSTA_LOCATIONIQ;
    rispostaOverpass = (query: string) =>
      contiene(query, LONTANO)
        ? { elements: [{ lat: LONTANO.lat, lon: LONTANO.lon, tags: { name: "Locanda di Campagna" } }] }
        : RISPOSTA_OVERPASS;

    const giornate = [
      { date: "2026-09-10", anchorTitle: "Colosseo" },
      { date: "2026-09-11", anchorTitle: "Gita fuori porta" },
    ];

    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({
          days: giornate.map((g) => ({ date: g.date, chosenId: 1, comment: "Un consiglio." })),
        })
      )
    );

    const response = await POST(richiesta({ ...corpoValido, days: giornate }));
    const body = await response.json();

    const query = interrogazioniOverpass();
    expect(query).toHaveLength(2);
    // Nessun raggio: dal 2026-08-26 anche la gita viaggia dentro un rettangolo.
    expect(query.filter((q) => q.includes("around:"))).toHaveLength(0);

    expect(response.status).toBe(200);
    expect(body.suggestions.map((s: { date: string; name: string }) => [s.date, s.name])).toEqual([
      ["2026-09-10", "Osteria Vicina"],
      ["2026-09-11", "Locanda di Campagna"],
    ]);
  });

  // Il rilievo del 2026-08-26. Il ripiego per le tappe lontane era un'interrogazione a
  // raggio **per tappa**, sequenziali e senza distanziamento: cioè il pattern che produce i
  // `429`, reintrodotto proprio dal lavoro che l'aveva eliminato. E non è un caso raro:
  // Napoli più la costiera espelle *tutto* il grappolo lontano, una tappa alla volta.
  // Quattro sere sulla costiera devono costare **una** interrogazione, non quattro.
  it("raggruppa le tappe lontane in un solo rettangolo, non una interrogazione a testa", async () => {
    rispostaLocationIqTappa = (url: string) =>
      url.includes("Costiera") ? [{ lat: String(LONTANO.lat), lon: String(LONTANO.lon) }] : RISPOSTA_LOCATIONIQ;
    rispostaOverpass = (query: string) =>
      contiene(query, LONTANO)
        ? { elements: [{ lat: LONTANO.lat, lon: LONTANO.lon, tags: { name: "Locanda di Campagna" } }] }
        : RISPOSTA_OVERPASS;

    const giornate = [
      { date: "2026-09-10", anchorTitle: "Colosseo" },
      { date: "2026-09-11", anchorTitle: "Costiera, primo giorno" },
      { date: "2026-09-12", anchorTitle: "Costiera, secondo giorno" },
      { date: "2026-09-13", anchorTitle: "Costiera, terzo giorno" },
      { date: "2026-09-14", anchorTitle: "Costiera, quarto giorno" },
    ];

    generateContent.mockResolvedValue(
      rispostaGemini(
        JSON.stringify({
          days: giornate.map((g) => ({ date: g.date, chosenId: 1, comment: "Un consiglio." })),
        })
      )
    );

    const response = await POST(richiesta({ ...corpoValido, days: giornate }));
    const body = await response.json();

    expect(interrogazioniOverpass()).toHaveLength(2);
    expect(body.suggestions).toHaveLength(5);
    expect(response.status).toBe(200);
  });

  // Il secondo rettangolo non deve partire addosso al primo. Il limite di Overpass è di due
  // richieste *simultanee* (misurato il 2026-08-26: `/api/status` dichiara «Rate limit: 2»,
  // e quattro richieste in parallelo hanno messo in coda le ultime due per 13,5s), quindi la
  // protezione vera è che il ciclo resti sequenziale; la finestra è la cautela in più, e
  // questo test pinna entrambe — un'attesa vera, con il suo valore, **fra** le due
  // interrogazioni.
  it("distanzia le interrogazioni Overpass quando i rettangoli sono più d'uno", async () => {
    rispostaLocationIqTappa = (url: string) =>
      url.includes("Gita") ? [{ lat: String(LONTANO.lat), lon: String(LONTANO.lon) }] : RISPOSTA_LOCATIONIQ;

    const giornate = [
      { date: "2026-09-10", anchorTitle: "Colosseo" },
      { date: "2026-09-11", anchorTitle: "Gita fuori porta" },
    ];
    generateContent.mockResolvedValue(rispostaGemini(JSON.stringify({ days: [] })));

    await POST(richiesta({ ...corpoValido, days: giornate }));

    const prima = registro.indexOf("overpass");
    const seconda = registro.indexOf("overpass", prima + 1);
    expect(seconda).toBeGreaterThan(prima);

    const atteseInMezzo = registro
      .slice(prima + 1, seconda)
      .filter((voce) => voce.startsWith("attesa:"))
      .map((voce) => Number(voce.slice("attesa:".length)));

    expect(atteseInMezzo).toHaveLength(1);
    expect(atteseInMezzo[0]).toBeGreaterThan(FINESTRA_MS - 100);
    expect(atteseInMezzo[0]).toBeLessThanOrEqual(FINESTRA_MS);
  });

  it("risponde 200 con un elenco vuoto quando manca la chiave del modello", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(richiesta(corpoValido));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });
});
