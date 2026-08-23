import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addDays } from "date-fns";
import { startOfToday, toCalendarDate } from "@/lib/calendar-date";
import { POST } from "./route";

// La risposta di Gemini è simulata a livello di SDK: il resto del modulo (ApiError,
// usato da classifyGenerationError) resta quello vero. La geocodifica è finta e senza
// coordinate, così il test non tocca la rete e salta anche la fase meteo.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

vi.mock("@/lib/geocode-destination", () => ({ geocodeDestination: vi.fn(async () => null) }));

// Date sempre nel futuro: lo schema di richiesta rifiuta i viaggi già passati, e un
// itinerario con date fisse scadrebbe da solo con l'andare del tempo.
const tripDates = Array.from({ length: 5 }, (_, index) =>
  toCalendarDate(addDays(startOfToday(), 30 + index))
);

function activity(title: string) {
  return {
    title,
    description: "Una descrizione dell'attività proposta.",
    estimatedCost: "10€",
    suggestedTime: "09:00–11:00",
    details: {
      about: "Qualche riga di contesto sull'attività.",
      gettingThere: "A dieci minuti a piedi dal centro.",
      tips: "Meglio arrivare presto.",
    },
  };
}

function itineraryText(dates: string[]): string {
  return JSON.stringify({
    days: dates.map((date) => ({
      date,
      mattina: [activity("Mattina")],
      pomeriggio: [activity("Pomeriggio")],
      sera: [activity("Sera")],
    })),
  });
}

function geminiResponse(text: string | undefined, finishReason: string | undefined) {
  return { text, candidates: [{ finishReason }] };
}

const validBody = {
  destination: "Roma",
  dateRange: { from: tripDates[0], to: tripDates[4] },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1000,
  styleNotes: "",
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/generate-itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-itinerary", () => {
  it("rifiuta un corpo non valido con 400 prima di chiamare Gemini", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("rifiuta un corpo JSON malformato con 400 senza lanciare un'eccezione non gestita", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("restituisce l'errore 'config' quando nessuna chiave Gemini è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalBackupKey = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "";

    try {
      const request = new Request("http://localhost/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "Roma",
          dateRange: { from: "2026-09-01", to: "2026-09-05" },
          participants: [{ type: "adulto", age: 35 }],
          budget: 1000,
          styleNotes: "",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe("config");
    } finally {
      if (originalKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalKey;
      }
      if (originalBackupKey === undefined) {
        delete process.env.GEMINI_API_KEY_BACKUP;
      } else {
        process.env.GEMINI_API_KEY_BACKUP = originalBackupKey;
      }
    }
  });

  it("rifiuta una richiesta con Content-Type: text/plain anche se il corpo è un JSON valido", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        destination: "Roma",
        dateRange: { from: "2026-09-01", to: "2026-09-05" },
        participants: [{ type: "adulto", age: 35 }],
        budget: 1000,
        styleNotes: "",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("rifiuta una richiesta senza header Content-Type anche se il corpo è un JSON valido", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      body: JSON.stringify({
        destination: "Roma",
        dateRange: { from: "2026-09-01", to: "2026-09-05" },
        participants: [{ type: "adulto", age: 35 }],
        budget: 1000,
        styleNotes: "",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
  });

  it("restituisce dettagli di validazione quando un campo obbligatorio è mancante", async () => {
    const request = new Request("http://localhost/api/generate-itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRange: { from: "2026-09-01", to: "2026-09-05" },
        participants: [{ type: "adulto", age: 35 }],
        budget: 1000,
        styleNotes: "",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_response");
    expect(body.details).toBeDefined();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    const destinationIssue = body.details.find((issue: { path: string }) => issue.path === "destination");
    expect(destinationIssue).toBeDefined();
  });
});

describe("POST /api/generate-itinerary — risposta del modello", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalBackupKey = process.env.GEMINI_API_KEY_BACKUP;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "chiave-di-prova";
    delete process.env.GEMINI_API_KEY_BACKUP;
    generateContent.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalBackupKey === undefined) delete process.env.GEMINI_API_KEY_BACKUP;
    else process.env.GEMINI_API_KEY_BACKUP = originalBackupKey;
  });

  it("restituisce l'itinerario quando i giorni coprono esattamente le date richieste", async () => {
    generateContent.mockResolvedValue(geminiResponse(itineraryText(tripDates), "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.itinerary.days).toHaveLength(5);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("scarta un itinerario con meno giorni delle date richieste", async () => {
    generateContent.mockResolvedValue(geminiResponse(itineraryText(tripDates.slice(0, 3)), "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("scarta un itinerario con date fuori dall'intervallo richiesto", async () => {
    const shifted = tripDates.map((_, index) => toCalendarDate(addDays(startOfToday(), 60 + index)));
    generateContent.mockResolvedValue(geminiResponse(itineraryText(shifted), "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("ritenta sul modello successivo quando la risposta è stata troncata (MAX_TOKENS)", async () => {
    generateContent
      .mockResolvedValueOnce(geminiResponse('{"days": [{"date": "2026-', "MAX_TOKENS"))
      .mockResolvedValueOnce(geminiResponse(itineraryText(tripDates), "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  // Un troncamento per esaurimento dei token è una proprietà del modello, non della
  // chiave API: riprovare con la seconda chiave sullo stesso modello brucia un tentativo
  // intero (fino a 45s) per riottenere lo stesso troncamento.
  it("dopo un troncamento passa al modello successivo, non alla chiave successiva", async () => {
    process.env.GEMINI_API_KEY_BACKUP = "chiave-di-riserva";
    generateContent
      .mockResolvedValueOnce(geminiResponse('{"days": [{"date": "2026-', "MAX_TOKENS"))
      .mockResolvedValueOnce(geminiResponse(itineraryText(tripDates), "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
    const primoModello = generateContent.mock.calls[0][0].model;
    const secondoModello = generateContent.mock.calls[1][0].model;
    expect(secondoModello).not.toBe(primoModello);
  });

  it("restituisce invalid_response quando ogni tentativo viene troncato", async () => {
    generateContent.mockResolvedValue(geminiResponse('{"days": [{"date": "2026-', "MAX_TOKENS"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("invalid_response");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("risponde subito con content_blocked su un blocco di contenuto, senza ritentare", async () => {
    generateContent.mockResolvedValue(geminiResponse(undefined, "SAFETY"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("content_blocked");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
