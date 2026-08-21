import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generateItineraryRequestSchema } from "@/lib/generate-itinerary-request";
import { itineraryResponseSchema } from "@/lib/itinerary-schema";
import { buildItineraryPrompt } from "@/lib/itinerary-prompt";
import { classifyGenerationError, isTimeoutError } from "@/lib/generate-itinerary-errors";
import { geocodeDestination } from "@/lib/geocode-destination";
import { getClimateAverages } from "@/lib/climate-forecast";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";
import { getCountryInfo } from "@/lib/country-info";
import { computeDeadline, getCallAttemptBudget } from "@/lib/gemini-call-budget";

// Ceiling di Vercel Hobby (e ben sotto quello Pro): la funzione viene comunque
// terminata dalla piattaforma a questo limite, qualunque valore dichiariamo qui.
export const maxDuration = 60;

// Quanto della finestra di maxDuration riserviamo al lavoro DOPO l'ultima chiamata
// a Gemini: JSON.parse della risposta, validazione zod dello schema itinerario
// (più grande di quello di /discover-trips) e serializzazione della risposta
// (itinerario + meteo + info paese), più overhead generico della piattaforma.
const RESPONSE_HEADROOM_MS = 5_000;
const USABLE_BUDGET_MS = maxDuration * 1_000 - RESPONSE_HEADROOM_MS;

// Tetto complessivo della fase che precede l'AI: geocodifica (LocationIQ, max
// 2.5s per costruzione) più meteo storico (cinque anni sequenziali su Open-Meteo,
// max 3s l'uno). Senza questo tetto la sola fase meteo poteva arrivare a 15s nel
// caso lento, e i due sono comunque tempo sottratto alla generazione: scaduto il
// tetto si prosegue con il clima parziale o assente (il prompt gestisce già il
// caso senza clima), perché l'itinerario vale più del meteo. La deadline è
// condivisa fra geocodifica e meteo, quindi la fase intera resta dentro i 12s e
// al ciclo su modelli/chiavi restano ~43s dei 55 utilizzabili.
const PRE_AI_PHASE_MS = 12_000;

// Tetto massimo per un singolo tentativo: nella pratica ogni tentativo riceve il
// minimo tra questo valore e il tempo davvero rimasto (vedi getCallAttemptBudget),
// quindi la somma di tutti i tentativi non può mai superare il tempo rimasto
// quando il ciclo di generazione inizia (USABLE_BUDGET_MS meno geocodifica/meteo).
const PER_CALL_CAP_MS = 45_000;

// Sotto questa soglia un nuovo tentativo non ha una possibilità realistica di
// completare un giro di andata e ritorno (rete + generazione + risposta) prima
// della scadenza: meglio rinunciare subito con il nostro messaggio in italiano
// che iniziare una chiamata condannata a finire con un 504 grezzo.
const MIN_CALL_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const startTime = Date.now();
  const deadline = computeDeadline(startTime, USABLE_BUDGET_MS);

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

  const preAiDeadline = Math.min(deadline, startTime + PRE_AI_PHASE_MS);

  const coordinates = await geocodeDestination(parsedRequest.data.destination);
  const climate =
    coordinates?.lat != null && coordinates?.lon != null
      ? await getClimateAverages(
          coordinates.lat,
          coordinates.lon,
          parsedRequest.data.dateRange.from,
          parsedRequest.data.dateRange.to,
          preAiDeadline
        )
      : null;

  const countryInfo = coordinates?.countryCode ? getCountryInfo(coordinates.countryCode) : null;

  const prompt = buildItineraryPrompt(parsedRequest.data, climate);

  const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

  let responseText: string | undefined;
  let finishReason: string | undefined;
  let firstCode: ReturnType<typeof classifyGenerationError> | undefined;

  let budgetExhausted = false;

  modelLoop:
  for (let m = 0; m < GEMINI_MODELS.length; m++) {
    const model = GEMINI_MODELS[m];
    for (let i = 0; i < apiKeys.length; i++) {
      const { callTimeoutMs } = getCallAttemptBudget(deadline, Date.now(), PER_CALL_CAP_MS, MIN_CALL_TIMEOUT_MS);
      if (callTimeoutMs === null) {
        console.error(
          "Generazione itinerario: tempo insufficiente per un altro tentativo, rinuncio prima della scadenza"
        );
        budgetExhausted = true;
        break modelLoop;
      }

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
              timeout: callTimeoutMs,
              // Un solo tentativo per chiamata: il giro di retry è la nostra
              // stessa iterazione su modelli/chiavi, che rispetta il budget di
              // tempo residuo. Lasciare la libreria ritentare internamente
              // moltiplicherebbe il timeout per il numero di retry.
              retryOptions: { attempts: 1 },
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

        // Un timeout non è un problema specifico del modello o della chiave: è il
        // budget di tempo che sta per finire. Ritentare altrove spenderebbe il
        // tempo residuo su un sintomo, non sulla causa, quindi non si passa né
        // alla chiave né al modello successivo.
        if (isTimeoutError(error)) {
          console.error(
            `Generazione itinerario: timeout sul modello ${model} (chiave #${i + 1}), rinuncio senza fallback`
          );
          break modelLoop;
        }

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

  if (!responseText && (budgetExhausted || firstCode)) {
    const finalCode = firstCode ?? "network";
    console.error(`Generazione itinerario fallita (${finalCode}), tempo scaduto prima di un tentativo riuscito`);
    const status = finalCode === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: finalCode }, { status });
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
