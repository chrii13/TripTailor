import { describe, it, expect } from "vitest";
import { ApiError } from "@google/genai";
import { classifyFinishReason, classifyGenerationError, isTimeoutError } from "./generate-itinerary-errors";

describe("classifyGenerationError", () => {
  it("classifica un errore di autenticazione (401) come 'config'", () => {
    const error = new ApiError({ message: "Invalid API key", status: 401 });
    expect(classifyGenerationError(error)).toBe("config");
  });

  it("classifica un errore di permessi (403) come 'config'", () => {
    const error = new ApiError({ message: "Forbidden", status: 403 });
    expect(classifyGenerationError(error)).toBe("config");
  });

  it("classifica un rate limit (429) come 'rate_limit'", () => {
    const error = new ApiError({ message: "Rate limited", status: 429 });
    expect(classifyGenerationError(error)).toBe("rate_limit");
  });

  it("classifica un errore 5xx come 'network'", () => {
    const error = new ApiError({ message: "Server error", status: 500 });
    expect(classifyGenerationError(error)).toBe("network");
  });

  it("classifica un errore 400 generico come 'invalid_response'", () => {
    const error = new ApiError({ message: "Bad request", status: 400 });
    expect(classifyGenerationError(error)).toBe("invalid_response");
  });

  it("classifica un errore non-ApiError (fallimento di rete prima di una risposta HTTP) come 'network'", () => {
    expect(classifyGenerationError(new TypeError("fetch failed"))).toBe("network");
  });

  it("classifica un errore generico non riconosciuto come 'network'", () => {
    expect(classifyGenerationError(new Error("qualcosa di inatteso"))).toBe("network");
  });

  it("classifica anche un timeout (AbortError) come 'network'", () => {
    const error = new DOMException("This operation was aborted", "AbortError");
    expect(classifyGenerationError(error)).toBe("network");
  });
});

describe("classifyFinishReason", () => {
  it("considera completa una generazione terminata con STOP", () => {
    expect(classifyFinishReason("STOP")).toBe("complete");
  });

  it("considera completa una risposta senza finishReason (campo assente)", () => {
    expect(classifyFinishReason(undefined)).toBe("complete");
  });

  it("chiede un altro tentativo quando la risposta è stata troncata dai token", () => {
    expect(classifyFinishReason("MAX_TOKENS")).toBe("retry");
  });

  it("chiede un altro tentativo su un'interruzione sconosciuta", () => {
    expect(classifyFinishReason("OTHER")).toBe("retry");
    expect(classifyFinishReason("RECITATION")).toBe("retry");
  });

  it("riconosce come blocco di contenuto i motivi dei filtri di sicurezza", () => {
    for (const reason of ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]) {
      expect(classifyFinishReason(reason)).toBe("blocked");
    }
  });
});

describe("isTimeoutError", () => {
  it("riconosce un AbortError come timeout", () => {
    const error = new DOMException("This operation was aborted", "AbortError");
    expect(isTimeoutError(error)).toBe(true);
  });

  it("non considera un errore di rete generico come timeout", () => {
    expect(isTimeoutError(new TypeError("fetch failed"))).toBe(false);
  });

  it("non considera un ApiError come timeout", () => {
    const error = new ApiError({ message: "Server error", status: 500 });
    expect(isTimeoutError(error)).toBe(false);
  });

  it("non considera un valore non Error come timeout", () => {
    expect(isTimeoutError("boom")).toBe(false);
  });
});
