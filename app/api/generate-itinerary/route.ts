import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyGenerationError } from "@/lib/generate-itinerary-errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = generateItineraryRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("Generazione itinerario: GEMINI_API_KEY non configurata");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const prompt = buildItineraryPrompt(parsedRequest.data);
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let responseText: string | undefined;
  let finishReason: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(itineraryResponseSchema),
        maxOutputTokens: 50000,
        thinkingConfig: { thinkingBudget: 1024 },
        httpOptions: {
          timeout: 30_000,
          retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
        },
      },
    });
    responseText = response.text;
    finishReason = response.candidates?.[0]?.finishReason;
  } catch (error) {
    const code = classifyGenerationError(error);
    console.error(`Generazione itinerario fallita (${code}):`, error);
    const status = code === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: code }, { status });
  }

  if (!responseText) {
    console.error("Generazione itinerario: risposta vuota da Gemini");
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  let parsedItinerary: unknown;
  try {
    parsedItinerary = JSON.parse(responseText);
  } catch (error) {
    console.error(
      `Generazione itinerario: JSON non valido nella risposta di Gemini (finishReason: ${finishReason})`,
      error,
      responseText,
    );
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const parsedResult = itineraryResponseSchema.safeParse(parsedItinerary);

  if (!parsedResult.success) {
    console.error("Generazione itinerario: risposta non conforme allo schema atteso", parsedResult.error);
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  return NextResponse.json({ itinerary: parsedResult.data });
}
