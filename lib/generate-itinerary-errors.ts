import { ApiError } from "@google/genai";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";

export function classifyGenerationError(error: unknown): ErrorCode {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "config";
    }
    if (error.status === 429) {
      return "rate_limit";
    }
    if (error.status >= 500) {
      return "network";
    }
    return "invalid_response";
  }
  return "network";
}
