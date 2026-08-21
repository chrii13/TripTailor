import { describe, it, expect } from "vitest";
import { POST } from "./route";

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
