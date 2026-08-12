import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyAnthropicError } from "@/lib/generate-itinerary-errors";

export async function POST(request: Request) {
  const body = await request.json();
  const parsedRequest = generateItineraryRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const prompt = buildItineraryPrompt(parsedRequest.data);
  const client = new Anthropic();

  try {
    const response = await client.messages.parse(
      {
        model: "claude-sonnet-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: zodOutputFormat(itineraryResponseSchema),
        },
      },
      { timeout: 30_000 }
    );

    if (!response.parsed_output) {
      console.error("Generazione itinerario: risposta non conforme allo schema atteso", response);
      return NextResponse.json({ error: "invalid_response" }, { status: 502 });
    }

    return NextResponse.json({ itinerary: response.parsed_output });
  } catch (error) {
    const code = classifyAnthropicError(error);
    console.error(`Generazione itinerario fallita (${code}):`, error);
    const status = code === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: code }, { status });
  }
}
