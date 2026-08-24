import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { dinnerSuggestionsRequestSchema } from "@/lib/dinner-suggestions-request";
import { dinnerSuggestionsResponseSchema } from "@/lib/dinner-suggestions-schema";
import { buildDinnerSuggestionsPrompt } from "@/lib/dinner-suggestions-prompt";
import { fetchDinnerCandidates, type DinnerCandidate } from "@/lib/dinner-candidates";
import { resolveDinnerChoice } from "@/lib/verify-dinner-choice";
import { geocodeDestination, geocodePlaceNear } from "@/lib/geocode-destination";
import { getGeminiApiKeys } from "@/lib/gemini-api-keys";
import { classifyGenerationError, classifyFinishReason, isTimeoutError } from "@/lib/generate-itinerary-errors";
import { computeDeadline, getCallAttemptBudget } from "@/lib/gemini-call-budget";

// Stesso tetto di piattaforma delle altre route AI (Vercel Hobby).
export const maxDuration = 60;

// Margine per il lavoro dopo l'ultima chiamata: JSON.parse, validazione e
// serializzazione di una risposta piccola.
const RESPONSE_HEADROOM_MS = 5_000;
const USABLE_BUDGET_MS = maxDuration * 1_000 - RESPONSE_HEADROOM_MS;

// Geocodifica delle tappe e Overpass hanno un tetto condiviso: sono la fase che precede
// il modello, e senza un tetto un Overpass appeso si mangerebbe il budget della scelta.
// Venti secondi bastano per una decina di giornate in parallelo e lasciano al modello il
// resto della finestra.
const PRE_MODEL_PHASE_MS = 20_000;
const GEOCODE_TIMEOUT_MS = 2_500;
const OVERPASS_TIMEOUT_MS = 5_000;

// Quante giornate si lavorano insieme. Non è illimitata perché LocationIQ e Overpass sono
// servizi pubblici e gratuiti che limitano a poche richieste al secondo: un viaggio di 14
// giorni tutto in parallelo sono 14 geocodifiche e 14 POST simultanei, cioè un rifiuto per
// eccesso di richieste come esito *normale*, con tutte le sere che finiscono a pescare
// dall'elenco attorno al centro città. Quattro per volta è un ritmo che quei limiti
// reggono, e ha l'effetto secondario di rendere davvero verificabile il tetto di fase, che
// si controlla fra un gruppo e l'altro.
const GIORNATE_PER_GRUPPO = 4;

const PER_CALL_CAP_MS = 25_000;
const MIN_CALL_TIMEOUT_MS = 8_000;

// Flash Lite per primo come in generate-itinerary: stessa ragione (è più rapido e ha
// quote più larghe), e qui la risposta chiesta è per giunta molto più corta.
const GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];

export interface DinnerSuggestion {
  date: string;
  name: string;
  comment: string;
  distanceMeters: number;
  street?: string;
  openingHours?: string;
}

/**
 * Questa route non restituisce mai un errore del modello al client: quando la chiama,
 * l'itinerario è già a schermo, e un messaggio rosso su una pagina che funziona è peggio
 * di una sera senza consiglio. Ogni fallimento — geocodifica, Overpass, modello,
 * identificativo fuori elenco — diventa un elenco vuoto o una giornata assente. L'unica
 * eccezione è il 400 sul corpo malformato, che è un difetto del chiamante.
 */
function nessunConsiglio(): NextResponse {
  return NextResponse.json({ suggestions: [] as DinnerSuggestion[] });
}

interface GiornataConCandidati {
  date: string;
  anchorTitle: string;
  candidates: DinnerCandidate[];
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const deadline = computeDeadline(startTime, USABLE_BUDGET_MS);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_response" }, { status: 400 });
  }

  const parsedRequest = dinnerSuggestionsRequestSchema.safeParse(body);
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

  const { destination, participants, budget, styleNotes, days } = parsedRequest.data;

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    console.error("Consigli cena: nessuna chiave Gemini configurata (GEMINI_API_KEY)");
    return nessunConsiglio();
  }

  try {
    const preModelDeadline = Math.min(deadline, startTime + PRE_MODEL_PHASE_MS);

    // La route si geocodifica la destinazione da sé: il client non ha le coordinate, e
    // /api/generate-itinerary non le restituisce. Sono anche il ripiego quando la
    // geocodifica di una singola tappa fallisce.
    const centro = await geocodeDestination(destination);
    if (centro?.lat == null || centro.lon == null) {
      console.error(`Consigli cena: destinazione "${destination}" non geocodificata, nessun consiglio`);
      return nessunConsiglio();
    }
    const coordinate = { lat: centro.lat, lon: centro.lon };

    // Fase 1 — i candidati. Le giornate sono indipendenti, quindi in parallelo, ma a
    // gruppi: il tetto di fase si controlla prima di ogni gruppo, e le giornate non
    // raggiunte entro il tetto restano semplicemente senza consiglio — un'assenza onesta
    // è meglio di un consiglio preso attorno al centro città perché il servizio pubblico
    // ci ha risposto "troppe richieste".
    const conCandidati: GiornataConCandidati[] = [];

    for (let inizio = 0; inizio < days.length; inizio += GIORNATE_PER_GRUPPO) {
      if (Date.now() >= preModelDeadline) {
        console.error(
          `Consigli cena: tetto della fase di ricerca superato, ${days.length - inizio} giornate restano senza candidati`
        );
        break;
      }

      const gruppo = await Promise.all(
        days.slice(inizio, inizio + GIORNATE_PER_GRUPPO).map(
          async (day): Promise<GiornataConCandidati | null> => {
            const punto =
              (await geocodePlaceNear(
                `${day.anchorTitle}, ${destination}`,
                coordinate,
                GEOCODE_TIMEOUT_MS
              )) ?? coordinate;

            const candidates = await fetchDinnerCandidates(
              punto.lat,
              punto.lon,
              OVERPASS_TIMEOUT_MS
            );
            return candidates.length > 0 ? { ...day, candidates } : null;
          }
        )
      );

      conCandidati.push(...gruppo.filter((g): g is GiornataConCandidati => g !== null));
    }

    // Nessun candidato da nessuna parte: non è un errore, è una risposta onesta.
    if (conCandidati.length === 0) {
      return nessunConsiglio();
    }

    // Fase 2 — la scelta. Una sola chiamata per tutto l'itinerario.
    const prompt = buildDinnerSuggestionsPrompt({
      destination,
      participants,
      budget,
      styleNotes,
      days: conCandidati,
    });

    let responseText: string | undefined;

    modelLoop: for (let m = 0; m < GEMINI_MODELS.length; m++) {
      const model = GEMINI_MODELS[m];
      for (let i = 0; i < apiKeys.length; i++) {
        const { callTimeoutMs } = getCallAttemptBudget(
          deadline,
          Date.now(),
          PER_CALL_CAP_MS,
          MIN_CALL_TIMEOUT_MS
        );
        if (callTimeoutMs === null) {
          console.error("Consigli cena: tempo insufficiente per un altro tentativo, rinuncio");
          break modelLoop;
        }

        const client = new GoogleGenAI({ apiKey: apiKeys[i] });
        try {
          const response = await client.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseJsonSchema: z.toJSONSchema(dinnerSuggestionsResponseSchema),
              maxOutputTokens: 8000,
              thinkingConfig: { thinkingBudget: 512 },
              httpOptions: { timeout: callTimeoutMs, retryOptions: { attempts: 1 } },
            },
          });

          // Il finishReason va letto PRIMA del JSON.parse: una risposta troncata produce
          // un JSON spezzato, e un blocco di contenuto non migliora ritentando.
          const reason = response.candidates?.[0]?.finishReason;
          const outcome = classifyFinishReason(reason);

          if (outcome === "blocked") {
            console.error(`Consigli cena: contenuto bloccato dal modello ${model} (finishReason: ${reason})`);
            return nessunConsiglio();
          }

          if (outcome === "retry") {
            console.error(
              `Consigli cena: risposta interrotta dal modello ${model} (finishReason: ${reason}), tentativo con il modello successivo`
            );
            continue modelLoop;
          }

          responseText = response.text;
          break modelLoop;
        } catch (error) {
          const code = classifyGenerationError(error);
          const hasNextKey = i < apiKeys.length - 1;
          const hasNextModel = m < GEMINI_MODELS.length - 1;

          // Un timeout è il budget di tempo che finisce, non un problema del modello o
          // della chiave: ritentare altrove spenderebbe il residuo su un sintomo.
          if (isTimeoutError(error)) {
            console.error(`Consigli cena: timeout sul modello ${model} (chiave #${i + 1}), rinuncio`);
            break modelLoop;
          }

          if (code === "rate_limit" && hasNextKey) {
            console.error(
              `Consigli cena: chiave Gemini #${i + 1} in rate limit (modello ${model}), tentativo con la chiave successiva`
            );
            continue;
          }

          if ((code === "rate_limit" || code === "network") && hasNextModel) {
            console.error(
              `Consigli cena: modello ${model} non disponibile (${code}), tentativo con il modello successivo`
            );
            continue modelLoop;
          }

          console.error(`Consigli cena: chiamata al modello fallita (${code})`, error);
          break modelLoop;
        }
      }
    }

    if (!responseText) {
      console.error("Consigli cena: nessuna risposta utile dal modello, nessun consiglio");
      return nessunConsiglio();
    }

    let rispostaGrezza: unknown;
    try {
      rispostaGrezza = JSON.parse(responseText);
    } catch (error) {
      console.error("Consigli cena: JSON non valido nella risposta del modello", error);
      return nessunConsiglio();
    }

    const parsedResponse = dinnerSuggestionsResponseSchema.safeParse(rispostaGrezza);
    if (!parsedResponse.success) {
      console.error("Consigli cena: risposta non conforme allo schema atteso", parsedResponse.error);
      return nessunConsiglio();
    }

    // Fase 3 — il cancello.
    //
    // Lo schema garantisce la forma della risposta, non il senso: `days` può contenere due
    // scelte con la stessa data, ed entrambe passerebbero il resto dei controlli
    // producendo due cene per la stessa sera. È la stessa diffidenza di
    // `verifyItineraryDays` verso i giorni dell'itinerario, applicata però una giornata
    // alla volta: qui una sera in meno non invalida le altre, quindi la prima occorrenza
    // vince e le successive si scartano invece di far fallire tutta la risposta.
    const giornateGiaConsigliate = new Set<string>();

    const suggestions = parsedResponse.data.days.flatMap((scelta): DinnerSuggestion[] => {
      if (giornateGiaConsigliate.has(scelta.date)) {
        console.error(
          `Consigli cena: seconda scelta per la giornata ${scelta.date}, scartata (vale la prima)`
        );
        return [];
      }

      // La data si segna qui, non dopo il cancello: vale la *prima* scelta per quella
      // sera, anche quando viene scartata. Segnarla solo in caso di successo lascerebbe
      // che una seconda scelta subentri alla prima, cioè esattamente il ripensamento che
      // non vogliamo concedere al modello.
      giornateGiaConsigliate.add(scelta.date);

      const giornata = conCandidati.find((g) => g.date === scelta.date);
      if (!giornata) {
        console.error(`Consigli cena: giornata ${scelta.date} non richiesta, scelta scartata`);
        return [];
      }

      const locale = resolveDinnerChoice(giornata.candidates, scelta.chosenId);
      if (!locale) {
        console.error(
          `Consigli cena: identificativo ${scelta.chosenId} fuori elenco per ${scelta.date}`
        );
        return [];
      }

      // Nome, via, distanza e orari vengono dai dati OSM. Della risposta del modello
      // sopravvive solo il commento.
      return [
        {
          date: giornata.date,
          name: locale.name,
          distanceMeters: locale.distanceMeters,
          street: locale.street,
          openingHours: locale.openingHours,
          comment: scelta.comment,
        },
      ];
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Consigli cena: fallimento inatteso, nessun consiglio", error);
    return nessunConsiglio();
  }
}
