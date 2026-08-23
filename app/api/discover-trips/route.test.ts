import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

// La risposta di Gemini è simulata a livello di SDK: il resto del modulo (ApiError,
// usato da classifyGenerationError) resta quello vero.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

function geminiResponse(text: string | undefined, finishReason: string | undefined) {
  return { text, candidates: [{ finishReason }] };
}

const proposalsText = JSON.stringify({
  proposals: [
    {
      destination: "Lisbona",
      country: "Portogallo",
      whyItFits: "Ci stai dentro col budget e in quattro giorni la giri bene.",
      highlights: ["Alfama", "Belém", "Tram 28"],
      costs: { travelPerPerson: 200, travelTotal: 200, lodgingTotal: 300, onSiteTotal: 200, total: 700 },
    },
  ],
});

const validBody = {
  departureCity: "Milano, Italia",
  dateRange: { from: "2026-09-01", to: "2026-09-05" },
  participants: [{ type: "adulto", age: 35 }],
  budget: 1500,
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/discover-trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/discover-trips", () => {
  it("rifiuta un Content-Type non JSON con 400 prima di chiamare Gemini", async () => {
    const request = new Request("http://localhost/api/discover-trips", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "ciao",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("rifiuta un corpo non valido con 400 prima di chiamare Gemini", async () => {
    const response = await POST(jsonRequest({ departureCity: "" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("rifiuta un corpo JSON malformato con 400 senza lanciare un'eccezione non gestita", async () => {
    const response = await POST(jsonRequest("not valid json{"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_response");
  });

  it("restituisce l'errore 'config' quando nessuna chiave Gemini è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalBackupKey = process.env.GEMINI_API_KEY_BACKUP;
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI_API_KEY_BACKUP = "";

    try {
      const response = await POST(jsonRequest(validBody));

      expect(response.status).toBe(502);
      expect((await response.json()).error).toBe("config");
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
});

describe("POST /api/discover-trips — risposta del modello", () => {
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

  it("restituisce le proposte quando la generazione è completa", async () => {
    generateContent.mockResolvedValue(geminiResponse(proposalsText, "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect((await response.json()).proposals).toHaveLength(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("ritenta sul modello successivo quando la risposta è stata troncata (MAX_TOKENS)", async () => {
    generateContent
      .mockResolvedValueOnce(geminiResponse('{"proposals": [{"destination": "Lis', "MAX_TOKENS"))
      .mockResolvedValueOnce(geminiResponse(proposalsText, "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  // Un troncamento dipende dal modello, non dalla chiave API: ripetere lo stesso modello
  // con la chiave di riserva spende un tentativo intero per lo stesso esito.
  it("dopo un troncamento passa al modello successivo, non alla chiave successiva", async () => {
    process.env.GEMINI_API_KEY_BACKUP = "chiave-di-riserva";
    generateContent
      .mockResolvedValueOnce(geminiResponse('{"proposals": [{"destination": "Lis', "MAX_TOKENS"))
      .mockResolvedValueOnce(geminiResponse(proposalsText, "STOP"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).not.toBe(generateContent.mock.calls[0][0].model);
  });

  it("risponde subito con content_blocked su un blocco di contenuto, senza ritentare", async () => {
    generateContent.mockResolvedValue(geminiResponse(undefined, "PROHIBITED_CONTENT"));

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("content_blocked");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
