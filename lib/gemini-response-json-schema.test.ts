import { describe, it, expect } from "vitest";
import { z } from "zod";
import { itineraryResponseSchema } from "./itinerary-schema";
import { discoverTripsResponseSchema } from "./discover-trips-schema";
import { dinnerSuggestionsResponseSchema } from "./dinner-suggestions-schema";

/**
 * Rete di sicurezza per un difetto che nessun altro test può vedere: le route AI sono
 * testate con Gemini simulato, quindi uno schema che zod sa emettere ma che Gemini
 * rifiuta passa tutta la suite e si scopre solo in produzione, come un
 * `400 INVALID_ARGUMENT` che l'utente vede come `502 invalid_response`.
 *
 * La lista sotto non viene dalla documentazione ma da prove dirette contro l'API il
 * 2026-08-23, chiamando Gemini con lo schema vero dell'itinerario e togliendo un
 * vincolo alla volta:
 *   - schema con `maxItems`                       → 400 INVALID_ARGUMENT
 *   - stesso schema senza il solo `maxItems`      → accettato
 *   - `minItems`, `minLength`, `maxLength`        → accettati
 * Su uno schema piatto e semplice `maxItems` risulta invece accettato: il rifiuto si
 * manifesta sul nostro schema annidato, quindi la lista è una regola pratica per
 * QUESTI schemi, non una verità generale sull'API.
 *
 * Se si scopre un'altra chiave rifiutata, si aggiunge qui (con la data e l'esito della
 * prova) e si toglie dallo schema il vincolo che la emette.
 */
const KEYS_REJECTED_BY_GEMINI = ["maxItems"];

/** Percorsi (in stile JSON Pointer) di ogni occorrenza delle chiavi vietate. */
function findRejectedKeys(node: unknown, path = "#"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findRejectedKeys(item, `${path}/${index}`));
  }
  if (node === null || typeof node !== "object") return [];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => {
    const here = `${path}/${key}`;
    const found = KEYS_REJECTED_BY_GEMINI.includes(key) ? [`${here} (= ${JSON.stringify(value)})`] : [];
    return [...found, ...findRejectedKeys(value, here)];
  });
}

describe("schemi inviati a Gemini come responseJsonSchema", () => {
  it.each([
    ["itinerario (/api/generate-itinerary)", itineraryResponseSchema],
    ["proposte (/api/discover-trips)", discoverTripsResponseSchema],
    ["consigli cena (scelta del ristorante)", dinnerSuggestionsResponseSchema],
  ])("%s non contiene chiavi che Gemini rifiuta", (_name, schema) => {
    const found = findRejectedKeys(z.toJSONSchema(schema));
    expect(
      found,
      `Chiavi rifiutate da Gemini trovate nello schema (${KEYS_REJECTED_BY_GEMINI.join(", ")}): ` +
        `${found.join(", ")}. Sono emesse da un vincolo zod (es. .max() su un array emette maxItems): ` +
        `toglilo dallo schema, la validazione va fatta dopo il safeParse.`
    ).toEqual([]);
  });

  // Se questo test fallisce, la funzione di ricerca non guarda più dove deve (schema
  // cambiato di forma, o chiave rinominata) e il test sopra passerebbe a vuoto.
  it("la ricerca trova davvero la chiave quando c'è", () => {
    const withCap = z.toJSONSchema(z.object({ days: z.array(z.object({ date: z.string() })).max(14) }));
    expect(findRejectedKeys(withCap)).toEqual(["#/properties/days/maxItems (= 14)"]);
  });
});
