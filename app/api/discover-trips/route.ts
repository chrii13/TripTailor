import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { discoverTripsRequestSchema, getRequestNights } from "@/lib/discover-trips-request";
import { discoverTripsResponseSchema } from "@/lib/discover-trips-schema";
import { buildDiscoverTripsPrompt } from "@/lib/discover-trips-prompt";
import { verifyProposalsAgainstBudget } from "@/lib/verify-proposal-budget";
import { verifyProposalsAgainstSuggestedWindow } from "@/lib/verify-suggested-window";
import { stripSuggestedWindowIfExact } from "@/lib/strip-suggested-window";
import {
  classifyFinishReason,
  classifyGenerationError,
  isTimeoutError,
} from "@/lib/generate-itinerary-errors";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";
import { computeDeadline, getCallAttemptBudget } from "@/lib/gemini-call-budget";

// Flash Lite per primo, non per ultimo (2026-08-24). L'alias gemini-flash-latest punta
// oggi a Gemini 3.7 Flash, che su questo prompt misura 43s per un itinerario di 4 giorni
// contro un tetto per chiamata di 45s, e in questi giorni risponde spesso 503 ("high
// demand"); gemini-flash-lite-latest (Gemini 3.5 Flash Lite) fa lo stesso lavoro in 17s,
// e in 28s sui 14 giorni massimi. Con l'ordine precedente il primo tentativo sforava il
// tetto, e un timeout esce dal ciclo senza fallback (vedi il catch piu' sotto): l'utente
// vedeva un 502 dopo 55s. Il modello piu' lento resta come seconda scelta. L'ordine e'
// anche piu' gentile con le quote del livello gratuito: 500 richieste al giorno su Flash
// Lite contro 20 su Flash.
const GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];

// Ceiling di Vercel Hobby (e ben sotto quello Pro): la funzione viene comunque
// terminata dalla piattaforma a questo limite, qualunque valore dichiariamo qui.
export const maxDuration = 60;

// Quanto della finestra di maxDuration riserviamo al lavoro DOPO l'ultima chiamata
// a Gemini: JSON.parse della risposta, validazione zod, verifica budget/finestra
// suggerita, serializzazione della risposta e overhead generico della piattaforma.
// Tutto questo lavoro è in memoria e dura tipicamente pochi millisecondi: 5s è un
// margine ampio, non una stima stretta.
const RESPONSE_HEADROOM_MS = 5_000;
const USABLE_BUDGET_MS = maxDuration * 1_000 - RESPONSE_HEADROOM_MS;

// Tetto massimo per un singolo tentativo: nella pratica ogni tentativo riceve il
// minimo tra questo valore e il tempo davvero rimasto (vedi getCallAttemptBudget),
// quindi la somma di tutti i tentativi non può mai superare USABLE_BUDGET_MS.
const PER_CALL_CAP_MS = 50_000;

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

  let budgetExhausted = false;
  let truncated = false;

  modelLoop:
  for (let m = 0; m < GEMINI_MODELS.length; m++) {
    const model = GEMINI_MODELS[m];
    for (let i = 0; i < apiKeys.length; i++) {
      const { callTimeoutMs } = getCallAttemptBudget(deadline, Date.now(), PER_CALL_CAP_MS, MIN_CALL_TIMEOUT_MS);
      if (callTimeoutMs === null) {
        console.error("Ricerca inversa: tempo insufficiente per un altro tentativo, rinuncio prima della scadenza");
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
            responseJsonSchema: z.toJSONSchema(discoverTripsResponseSchema),
            maxOutputTokens: 20000,
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
        const reason = response.candidates?.[0]?.finishReason;
        const outcome = classifyFinishReason(reason);

        // Un blocco di contenuto dipende dalla richiesta, non dal modello: ritentare
        // altrove darebbe lo stesso esito spendendo altri token. Meglio dirlo subito, e
        // con un codice distinto da "risposta vuota", che ha tutt'altra causa.
        if (outcome === "blocked") {
          console.error(`Ricerca inversa: contenuto bloccato dal modello ${model} (finishReason: ${reason})`);
          return NextResponse.json({ error: "content_blocked" }, { status: 400 });
        }

        // Generazione interrotta a metà (tipicamente MAX_TOKENS): il JSON è troncato e
        // il parse fallirebbe comunque. Vale come tentativo fallito, non come successo.
        // Si passa al modello successivo, non alla chiave successiva: un troncamento
        // dipende da quanto è prolisso il modello, non dalla chiave API, quindi ripetere
        // lo stesso modello altrove spende un tentativo intero per lo stesso esito.
        if (outcome === "retry") {
          truncated = true;
          console.error(
            `Ricerca inversa: risposta interrotta dal modello ${model} (finishReason: ${reason}, chiave #${i + 1}), tentativo con il modello successivo`
          );
          continue modelLoop;
        }

        console.log(
          `Ricerca inversa: risposta completa dal modello ${model} (finishReason: ${reason ?? "assente"})`
        );
        responseText = response.text;
        finishReason = reason;
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
            `Ricerca inversa: timeout sul modello ${model} (chiave #${i + 1}), rinuncio senza fallback`
          );
          break modelLoop;
        }

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

  if (!responseText && (budgetExhausted || firstCode)) {
    const finalCode = firstCode ?? "network";
    console.error(`Ricerca inversa fallita (${finalCode}), tempo scaduto prima di un tentativo riuscito`);
    const status = finalCode === "rate_limit" ? 429 : 502;
    return NextResponse.json({ error: finalCode }, { status });
  }

  if (!responseText && truncated) {
    console.error("Ricerca inversa: ogni tentativo è stato interrotto prima della fine della risposta");
    return NextResponse.json({ error: "invalid_response" }, { status: 502 });
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
