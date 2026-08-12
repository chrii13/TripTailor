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

  it("restituisce l'errore 'config' quando GEMINI_API_KEY non è configurata", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      const request = new Request("http://localhost/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "Roma",
          dateRange: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-05T00:00:00.000Z" },
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
    }
  });
});
