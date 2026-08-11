import Anthropic from "@anthropic-ai/sdk";

export type ErrorCode = "network" | "config" | "rate_limit" | "invalid_response";

export function classifyAnthropicError(error: unknown): ErrorCode {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "config";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "rate_limit";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "network";
  }
  if (error instanceof Anthropic.InternalServerError) {
    return "network";
  }
  return "invalid_response";
}
