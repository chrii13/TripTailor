import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/generate-itinerary", () => {
  it("rifiuta un corpo non valido con 400 prima di chiamare Claude", async () => {
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
});
