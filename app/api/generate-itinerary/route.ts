import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyGenerationError } from "@/lib/generate-itinerary-errors";
import { geocodeDestination } from "@/lib/geocode-destination";
import { getClimateAverages } from "@/lib/climate-forecast";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";
import { getCountryInfo } from "@/lib/country-info";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(`Generazione itinerario: Content-Type non valido (${contentType ?? "assente"})`);
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = generateItineraryRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "invalid_response",
        details: parsedRequest.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    console.error("Generazione itinerario: nessuna chiave Gemini configurata (GEMINI_API_KEY)");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const coordinates = await geocodeDestination(parsedRequest.data.destination);
  const climate = coordinates
    ? await getClimateAverages(
        coordinates.lat,
        coordinates.lon,
        parsedRequest.data.dateRange.from,
        parsedRequest.data.dateRange.to
      )
    : null;

  const countryInfo = coordinates?.countryCode ? getCountryInfo(coordinates.countryCode) : null;

  const prompt = buildItineraryPrompt(parsedRequest.data, climate);

  const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

  let responseText: string | undefined;
  let finishReason: string | undefined;
  let firstCode: ReturnType<typeof classifyGenerationError> | undefined;

  modelLoop:
  for (let m = 0; m < GEMINI_MODELS.length; m++) {
    const model = GEMINI_MODELS[m];
    for (let i = 0; i < apiKeys.length; i++) {
      const client = new GoogleGenAI({ apiKey: apiKeys[i] });
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(itineraryResponseSchema),
            maxOutputTokens: 50000,
            thinkingConfig: { thinkingBudget: 1024 },
            httpOptions: {
              timeout: 180_000,
              retryOptions: { attempts: 2, httpStatusCodes: [408, 500, 502, 503, 504] },
            },
          },
        });
        responseText = response.text;
        finishReason = response.candidates?.[0]?.finishReason;
        break modelLoop;
      } catch (error) {
        const code = classifyGenerationError(error);
        firstCode ??= code;
        const hasNextKey = i < apiKeys.length - 1;
        const hasNextModel = m < GEMINI_MODELS.length - 1;

        if (code === "rate_limit" && hasNextKey) {
          console.error(
            `Generazione itinerario: chiave Gemini #${i + 1} in rate limit (modello ${model}), tentativo con la chiave successiva`
          );
          continue;
        }

        if ((code === "rate_limit" || code === "network") && hasNextModel) {
          console.error(
            `Generazione itinerario: modello ${model} non disponibile (${code}), tentativo con il modello successivo`
          );
          continue modelLoop;
        }

        const finalCode = firstCode ?? code;
        console.error(`Generazione itinerario fallita (${finalCode}):`, error);
        const status = finalCode === "rate_limit" ? 429 : 502;
        return NextResponse.json({ error: finalCode }, { status });
      }
    }
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

  return NextResponse.json({ itinerary: parsedResult.data, weather: climate, countryInfo });
}
