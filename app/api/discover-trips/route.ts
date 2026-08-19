import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { discoverTripsRequestSchema, getRequestNights } from "@/lib/discover-trips-request";
import { discoverTripsResponseSchema } from "@/lib/discover-trips-schema";
import { buildDiscoverTripsPrompt } from "@/lib/discover-trips-prompt";
import { verifyProposalsAgainstBudget } from "@/lib/verify-proposal-budget";
import { verifyProposalsAgainstSuggestedWindow } from "@/lib/verify-suggested-window";
import { stripSuggestedWindowIfExact } from "@/lib/strip-suggested-window";
import { classifyGenerationError } from "@/lib/generate-itinerary-errors";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

// Ceiling di Vercel Hobby (e ben sotto quello Pro): la funzione viene comunque
// terminata dalla piattaforma a questo limite, qualunque valore dichiariamo qui.
export const maxDuration = 60;

// Deve stare sotto maxDuration, altrimenti la piattaforma uccide la funzione
// prima che il nostro codice possa gestire l'errore. Lascia margine per il
// parsing/validazione della risposta dopo la chiamata a Gemini.
const GEMINI_CALL_TIMEOUT_MS = 50_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(`Ricerca inversa: Content-Type non valido (${contentType ?? "assente"})`);
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = discoverTripsRequestSchema.safeParse(body);

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
    console.error("Ricerca inversa: nessuna chiave Gemini configurata (GEMINI_API_KEY)");
    return NextResponse.json({ error: "config" }, { status: 502 });
  }

  const prompt = buildDiscoverTripsPrompt(parsedRequest.data);

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
            responseJsonSchema: z.toJSONSchema(discoverTripsResponseSchema),
            maxOutputTokens: 20000,
            thinkingConfig: { thinkingBudget: 1024 },
            httpOptions: {
              timeout: GEMINI_CALL_TIMEOUT_MS,
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
            `Ricerca inversa: chiave Gemini #${i + 1} in rate limit (modello ${model}), tentativo con la chiave successiva`
          );
          continue;
        }

        if ((code === "rate_limit" || code === "network") && hasNextModel) {
          console.error(
            `Ricerca inversa: modello ${model} non disponibile (${code}), tentativo con il modello successivo`
          );
          continue modelLoop;
        }

        const finalCode = firstCode ?? code;
        console.error(`Ricerca inversa fallita (${finalCode}):`, error);
        const status = finalCode === "rate_limit" ? 429 : 502;
        return NextResponse.json({ error: finalCode }, { status });
      }
    }
  }

  if (!responseText) {
    console.error("Ricerca inversa: risposta vuota da Gemini");
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  let parsedProposals: unknown;
  try {
    parsedProposals = JSON.parse(responseText);
  } catch (error) {
    console.error(
      `Ricerca inversa: JSON non valido nella risposta di Gemini (finishReason: ${finishReason})`,
      error,
      responseText
    );
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const parsedResult = discoverTripsResponseSchema.safeParse(parsedProposals);

  if (!parsedResult.success) {
    console.error("Ricerca inversa: risposta non conforme allo schema atteso", parsedResult.error);
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
  }

  const nights = getRequestNights(parsedRequest.data);
  const proposalsWithinBudget = verifyProposalsAgainstBudget(
    parsedResult.data.proposals,
    parsedRequest.data.budget,
    parsedRequest.data.participants.length,
    nights
  );
  const proposalsWithConsistentWindow = verifyProposalsAgainstSuggestedWindow(
    proposalsWithinBudget,
    parsedRequest.data.flexiblePeriod
  );
  const proposals = stripSuggestedWindowIfExact(
    proposalsWithConsistentWindow,
    parsedRequest.data.flexiblePeriod !== undefined
  );

  return NextResponse.json({ proposals });
}
