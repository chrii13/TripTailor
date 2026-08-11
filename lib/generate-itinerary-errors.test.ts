import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { classifyAnthropicError } from "./generate-itinerary-errors";

describe("classifyAnthropicError", () => {
  it("classifica un errore di autenticazione (401) come 'config'", () => {
    const error = new Anthropic.AuthenticationError(401, {}, "Invalid API key", new Headers());
    expect(classifyAnthropicError(error)).toBe("config");
  });

  it("classifica un errore di permessi (403) come 'config'", () => {
    const error = new Anthropic.PermissionDeniedError(403, {}, "Forbidden", new Headers());
    expect(classifyAnthropicError(error)).toBe("config");
  });

  it("classifica un rate limit (429) come 'rate_limit'", () => {
    const error = new Anthropic.RateLimitError(429, {}, "Rate limited", new Headers());
    expect(classifyAnthropicError(error)).toBe("rate_limit");
  });

  it("classifica un errore di connessione come 'network'", () => {
    const error = new Anthropic.APIConnectionError({ message: "Connection error" });
    expect(classifyAnthropicError(error)).toBe("network");
  });

  it("classifica un errore 5xx come 'network'", () => {
    const error = new Anthropic.InternalServerError(500, {}, "Server error", new Headers());
    expect(classifyAnthropicError(error)).toBe("network");
  });

  it("classifica un errore 400 generico come 'invalid_response'", () => {
    const error = new Anthropic.BadRequestError(400, {}, "Bad request", new Headers());
    expect(classifyAnthropicError(error)).toBe("invalid_response");
  });

  it("classifica un errore non riconosciuto come 'invalid_response'", () => {
    expect(classifyAnthropicError(new Error("qualcosa di inatteso"))).toBe("invalid_response");
  });
});
