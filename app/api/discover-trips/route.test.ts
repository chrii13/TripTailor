import { describe, it, expect } from "vitest";
import { POST } from "./route";

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
