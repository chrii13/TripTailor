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
//
// I due numeri sono stati **misurati** il 2026-08-25, non stimati, e valgono insieme:
// trenta secondi di fase con otto di tetto per singola interrogazione. Prima erano venti e
// cinque, tarati sull'idea che Overpass rispondesse in 1-2 secondi; quattro interrogazioni
// vere attorno a Bologna hanno invece dato 1,0s, 8,4s (504), 10,6s (504) e 17,3s. Con il
// tetto a cinque secondi *tutte* le giornate finivano in timeout e la risposta era un
// elenco vuoto anche in pieno centro di una città grande.
//
// Otto secondi prendono la parte buona di quella distribuzione senza inseguire la coda
// lunga.
//
// **PRE_MODEL_PHASE_MS non è una partizione del budget, ed è facile crederlo.** Il tetto si
// controlla *solo fra un gruppo e l'altro*, mai dentro: un gruppo che parte a 29,999s
// arriva a ~40,5s (2,5 di geocodifica più 8 di Overpass), cioè la fase può sforare il
// proprio tetto **di un gruppo intero**. Non esiste quindi nessun "30 + 25 + 5 = 60": a
// quel punto al modello non restano i 25 di PER_CALL_CAP_MS ma `deadline - now`, cioè
// ~14,5s.
//
// A garantire i 60 secondi è il residuo che `getCallAttemptBudget` calcola per la chiamata
// al modello — il minimo fra PER_CALL_CAP_MS e quel che resta fino alla scadenza — non la
// somma dei tetti. Il che vuol dire che alzare OVERPASS_TIMEOUT_MS non fa sforare
// maxDuration, ma **strozza in silenzio la chiamata al modello**: sotto MIN_CALL_TIMEOUT_MS
// il tentativo non parte nemmeno e l'itinerario resta senza consigli. È l'effetto da
// misurare prima di toccare questi numeri, non lo sforamento del tetto di piattaforma.
const PRE_MODEL_PHASE_MS = 30_000;
const GEOCODE_TIMEOUT_MS = 2_500;
const OVERPASS_TIMEOUT_MS = 8_000;

// Quante giornate si lavorano insieme. Non è illimitata perché LocationIQ e Overpass sono
// servizi pubblici e gratuiti che limitano a poche richieste al secondo: un viaggio di 14
// giorni tutto in parallelo sono 14 geocodifiche e 14 POST simultanei, cioè un rifiuto per
// eccesso di richieste come esito *normale*, con tutte le sere che finiscono a pescare
// dall'elenco attorno al centro città.
//
// Il numero era **quattro**, scelto a intuito, ed è stato corretto a due il 2026-08-25
// dopo averlo misurato: quattro geocodifiche LocationIQ in parallelo tornano
// `[200, 429, 429, 200]`, cioè metà delle sere perde la propria tappa e ripiega sul centro
// città. Due in parallelo tornano `[200, 200]` (il piano gratuito consente 2 richieste al
// secondo). È il difetto peggiore del genere, perché non produce nessun errore: i consigli
// arrivano lo stesso, solo attorno al posto sbagliato. **Non rialzarlo senza rimisurare.**
// La chiamata a Overpass che segue ogni geocodifica dura qualche secondo e fa da
// distanziatore naturale fra un gruppo e il successivo.
//
// **Conseguenza da conoscere: la funzionalità si ferma attorno alla sesta sera.** Un gruppo
// costa ~10,5s nel caso peggiore (2,5 di geocodifica + 8 di Overpass), quindi dentro i 30s
// di fase entrano tre gruppi — sei giornate — e il quarto trova il tetto già superato.
// Vale *indipendentemente dalla lunghezza del viaggio*: un viaggio di quattordici giorni
// riceve consigli per sei sere, non per quattordici. È un compromesso accettato, non una
// svista: meglio sei sere giuste e otto assenti che quattordici prese attorno al centro
// città perché i servizi pubblici ci hanno risposto "troppe richieste".
const GIORNATE_PER_GRUPPO = 2;

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
              // Largo per quel che serve: `GIORNATE_PER_GRUPPO` e `PRE_MODEL_PHASE_MS`
              // limitano la risposta a circa sei voci (vedi il conto sopra), non a una per
              // giornata di viaggio. Un itinerario di quattordici giorni non produce
              // quattordici scelte, quindi il caso lungo non è mai stato un rischio di
              // troncamento.
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
