import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { dinnerSuggestionsRequestSchema } from "@/lib/dinner-suggestions-request";
import { dinnerSuggestionsResponseSchema } from "@/lib/dinner-suggestions-schema";
import { buildDinnerSuggestionsPrompt } from "@/lib/dinner-suggestions-prompt";
import {
  fetchPlacesInBoundingBox,
  selectNearbyCandidates,
  type DinnerCandidate,
  type OverpassPlace,
} from "@/lib/dinner-candidates";
import { raggruppaPerRiquadri } from "@/lib/dinner-bounding-box";
import { finestraScorrevole } from "@/lib/finestra-scorrevole";
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

// ── Il budget di tempo della fase che precede il modello ────────────────────────────────
//
// Dal 2026-08-26 la fase ha due tempi ben separati, e ciascuno il proprio tetto:
//
//   1. la geocodifica delle tappe, a gruppi di due (LocationIQ), entro GEOCODE_PHASE_MS;
//   2. un'interrogazione Overpass per **rettangolo** — una sola per un itinerario in una
//      città sola, che è il caso normale — entro PRE_MODEL_PHASE_MS.
//
// Prima l'interrogazione era una per sera, e le misure del 2026-08-26 hanno mostrato che
// era proprio quello il problema: sei richieste `around` identiche alle stesse coordinate
// di Bologna hanno dato 1,0s, 1,0s, 16,5s, 10,3s e poi due `429` (dopo 10,5s e 10,3s). I
// rifiuti arrivavano *dopo* le prime richieste ravvicinate, cioè ci stavamo autolimitando,
// e più lungo era il viaggio peggio andava. Allargare l'area invece costa poco: vedi la
// tabella delle misure in `lib/dinner-bounding-box.ts`.
//
// **I tetti ora si sommano davvero**, ed è un cambiamento rispetto a com'era prima. Il
// vecchio commento avvertiva giustamente che `PRE_MODEL_PHASE_MS` non era una partizione
// del budget, perché il controllo cadeva solo *fra* un gruppo e l'altro e una fase poteva
// sforare di un gruppo intero. Adesso non può: il numero di gruppi di geocodifica è
// limitato dal controllo con anticipo di GEOCODE_TIMEOUT_MS, e il timeout dell'unica
// interrogazione Overpass è **ritagliato sul residuo** invece che fisso. Il conto del caso
// peggiore torna:
//
//   20s (geocodifica) + 20s (Overpass) + 15s (modello, residuo) + 5s (margine) = 60s
//
// A garantire il tetto di piattaforma resta comunque `getCallAttemptBudget`, che prende il
// minimo fra PER_CALL_CAP_MS e quel che manca alla scadenza: nel caso normale la fase
// costa ~9s e al modello restano i 25s pieni.
const PRE_MODEL_PHASE_MS = 40_000;
const GEOCODE_PHASE_MS = 20_000;
const GEOCODE_TIMEOUT_MS = 2_500;

// Una sola interrogazione può permettersi di aspettare molto più di quando erano una per
// sera (erano 8s). Misure del 2026-08-26 su rettangoli veri attorno a Bologna: 0,8s a 4 km²,
// 1,0-1,4s a 900 km², 2,3s a 2.500 km². I `429`, invece, arrivano *lenti*, dopo 11,9s e
// 14,3s: venti secondi lasciano passare anche una risposta buona ma tardiva senza inseguire
// la coda dei fallimenti. Sotto MIN_OVERPASS_TIMEOUT_MS non si parte nemmeno: una richiesta
// che sappiamo di dover abortire è tempo tolto al modello.
const OVERPASS_TIMEOUT_MS = 20_000;
const MIN_OVERPASS_TIMEOUT_MS = 3_000;

// Quante tappe si geocodificano insieme. Il piano gratuito di LocationIQ consente **2
// richieste al secondo**: il numero era quattro, scelto a intuito, ed è stato corretto a due
// il 2026-08-25 dopo averlo misurato — quattro in parallelo tornano `[200, 429, 429, 200]`,
// cioè metà delle sere perde la propria tappa e ripiega sul centro città. È il difetto
// peggiore del genere, perché non produce nessun errore: i consigli arrivano lo stesso, solo
// attorno al posto sbagliato. **Non rialzarlo senza rimisurare.**
const GIORNATE_PER_GRUPPO = 2;

// Il distanziamento fra un gruppo e il successivo, ed è **nuovo**: prima non serviva perché
// la chiamata a Overpass che seguiva ogni giornata durava secondi e faceva da distanziatore
// naturale. Toglierla ha tolto anche quello, e la misura del 2026-08-26 lo mostra senza
// ambiguità — 14 tappe di Bologna a gruppi di due, senza pausa, hanno dato 10 risposte
// `429` su 14 (in 1,5s totali); con una finestra di un secondo, 14 su 14 a 200 in 7,2s.
// Non è una pausa fissa ma una finestra: si aspetta solo il tempo che manca al secondo
// *dall'inizio delle richieste precedenti*, quindi un gruppo lento non paga nulla e il
// costo per gruppo resta al massimo GEOCODE_TIMEOUT_MS. La finestra parte dalla
// geocodifica della destinazione, che è una richiesta come le altre.
const FINESTRA_LOCATIONIQ_MS = 1_000;

// Lo stesso distanziamento fra un'interrogazione Overpass e la successiva, nel caso — non
// più raro di tanto — in cui i rettangoli siano più d'uno (due grappoli di tappe distanti).
//
// **Che cosa dicono le misure del 2026-08-26**, perché questo numero non nasce da un `429`
// osservato: `/api/status` dichiara «Rate limit: 2», e sono **due slot simultanei**, non una
// frequenza. Dieci interrogazioni sequenziali su rettangoli veri da 900 km² hanno dato
// **dieci 200 e nessun 429**; le stesse quattro lanciate *in parallelo* sono passate tutte
// ma due hanno atteso 13,5s in coda — ed è la firma dei «429 lenti, dopo 12-14s» annotati
// prima. Conclusione: a limitarci è la **concorrenza**, non il ritmo.
//
// Ne discendono due cose, e la prima conta più della seconda: (1) il ciclo delle
// interrogazioni deve restare **sequenziale**, mai un `Promise.all` — è quella la
// protezione vera; (2) la finestra resta come cautela a buon mercato, perché uno slot che
// abbiamo abbandonato per timeout resta occupato sul server e non lo vediamo. Costa un
// secondo una volta sola, e solo su un itinerario a più rettangoli.
const FINESTRA_OVERPASS_MS = 1_000;

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
  // Le coordinate OSM del locale: servono al client per il collegamento alla mappa, che
  // deve centrarla sul locale vero e non sul primo omonimo.
  lat: number;
  lon: number;
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

/** Una giornata con le coordinate della sua tappa: il passo intermedio fra le due fasi. */
interface GiornataAncorata {
  date: string;
  anchorTitle: string;
  lat: number;
  lon: number;
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
    const geocodeDeadline = Math.min(deadline, startTime + GEOCODE_PHASE_MS);

    // La route si geocodifica la destinazione da sé: il client non ha le coordinate, e
    // /api/generate-itinerary non le restituisce. Sono anche il ripiego quando la
    // geocodifica di una singola tappa fallisce.
    //
    // Questa chiamata apre anche la finestra di distanziamento di LocationIQ:
    // è una richiesta come le altre, e senza contarla il primo gruppo di tappe ne farebbe
    // tre nello stesso secondo. Nella prova sul campo del 2026-08-26 era l'unico `429`
    // rimasto, cioè una sera cercata attorno al centro città invece che alla sua tappa.
    const finestraLocationIq = finestraScorrevole(FINESTRA_LOCATIONIQ_MS);
    const centro = await geocodeDestination(destination);
    if (centro?.lat == null || centro.lon == null) {
      console.error(`Consigli cena: destinazione "${destination}" non geocodificata, nessun consiglio`);
      return nessunConsiglio();
    }
    const coordinate = { lat: centro.lat, lon: centro.lon };

    // Fase 1a — dove si cena. Le tappe sono indipendenti, quindi in parallelo, ma a
    // gruppi distanziati: il tetto si controlla prima di ogni gruppo, con l'anticipo di
    // una geocodifica intera, così la fase non può sforarlo. Le tappe non raggiunte entro
    // il tetto restano senza consiglio — un'assenza onesta è meglio di un consiglio preso
    // attorno al centro città perché il servizio pubblico ci ha risposto "troppe richieste".
    const ancorate: GiornataAncorata[] = [];

    for (let inizio = 0; inizio < days.length; inizio += GIORNATE_PER_GRUPPO) {
      const attesa = Math.max(finestraLocationIq.attesaMs(), 0);

      if (Date.now() + attesa + GEOCODE_TIMEOUT_MS > geocodeDeadline) {
        console.error(
          `Consigli cena: tetto della geocodifica superato, ${days.length - inizio} giornate restano senza tappa`
        );
        break;
      }

      await finestraLocationIq.distanzia();

      const gruppo = await Promise.all(
        days.slice(inizio, inizio + GIORNATE_PER_GRUPPO).map(
          async (day): Promise<GiornataAncorata> => ({
            ...day,
            // Il centro della destinazione è il ripiego quando la tappa non si geocodifica.
            ...((await geocodePlaceNear(
              `${day.anchorTitle}, ${destination}`,
              coordinate,
              GEOCODE_TIMEOUT_MS
            )) ?? coordinate),
          })
        )
      );
      ancorate.push(...gruppo);
    }

    // Fase 1b — i locali. Un'interrogazione per **rettangolo**, e nel caso normale — un
    // itinerario in una città sola — il rettangolo è uno solo: le distanze di ciascuna sera
    // si ricavano poi in casa, senza toccare la rete. Le tappe troppo lontane per starci
    // dentro non ricevono più un raggio a testa ma un rettangolo condiviso (vedi
    // `raggruppaPerRiquadri`), così due grappoli distanti costano due richieste e non sei.
    const gruppi = raggruppaPerRiquadri(ancorate, coordinate);
    const conCandidati: GiornataConCandidati[] = [];

    const raccogli = (giornata: GiornataAncorata, luoghi: OverpassPlace[]) => {
      const candidates = selectNearbyCandidates(luoghi, giornata.lat, giornata.lon);
      if (candidates.length > 0) {
        conCandidati.push({ date: giornata.date, anchorTitle: giornata.anchorTitle, candidates });
      }
    };

    // Il timeout non è fisso: è il minimo fra il tetto per interrogazione e quel che resta
    // della fase, tolta l'attesa di distanziamento ancora da pagare. È così che i tetti
    // tornano a sommarsi (vedi il conto sopra).
    const timeoutResiduo = (attesaMs = 0) =>
      Math.min(OVERPASS_TIMEOUT_MS, preModelDeadline - Date.now() - attesaMs);

    // La prima interrogazione non ha nulla da cui distanziarsi: la finestra nasce scaduta.
    // Il ciclo è **sequenziale** di proposito — vedi FINESTRA_OVERPASS_MS: il limite di
    // Overpass è di due richieste *simultanee*, e due nostre in volo insieme si mettono in
    // coda a vicenda per una dozzina di secondi.
    const finestraOverpass = finestraScorrevole(FINESTRA_OVERPASS_MS, 0);

    for (const gruppo of gruppi) {
      const attesa = Math.max(finestraOverpass.attesaMs(), 0);

      if (timeoutResiduo(attesa) < MIN_OVERPASS_TIMEOUT_MS) {
        console.error(
          `Consigli cena: tempo esaurito, ${gruppo.punti.length} giornate restano senza candidati`
        );
        break;
      }

      await finestraOverpass.distanzia();

      const luoghi = await fetchPlacesInBoundingBox(gruppo.riquadro, timeoutResiduo());
      for (const giornata of gruppo.punti) raccogli(giornata, luoghi);
    }

    // I gruppi lontani sono stati raccolti in coda: il prompt vuole le giornate in
    // ordine di calendario, come le legge l'utente.
    conCandidati.sort((a, b) => a.date.localeCompare(b.date));

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
              // Ora la risposta può davvero avere **una voce per giornata di viaggio**:
              // fino al 2026-08-26 il tetto di fase la fermava attorno alla sesta, ed è
              // proprio il limite che l'interrogazione unica ha rimosso. Quattordici voci
              // da un identificativo e una frase stanno larghe in ottomila token, ma il
              // margine non va più giustificato con "tanto sono sei".
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

      // Nome, coordinate, via, distanza e orari vengono dai dati OSM. Della risposta del
      // modello sopravvive solo il commento.
      return [
        {
          date: giornata.date,
          name: locale.name,
          distanceMeters: locale.distanceMeters,
          lat: locale.lat,
          lon: locale.lon,
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
