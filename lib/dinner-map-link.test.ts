import { describe, it, expect } from "vitest";
import { buildDinnerMapUrl } from "./dinner-map-link";

// Coordinate vere di due locali incontrati sul campo (Bologna, Castelmezzano).
const BOLOGNA = { lat: 44.4938, lon: 11.3426 };

describe("buildDinnerMapUrl", () => {
  it("cerca il nome del locale centrando la mappa sulle sue coordinate", () => {
    expect(buildDinnerMapUrl("Osteria del Sole", BOLOGNA.lat, BOLOGNA.lon)).toBe(
      "https://www.google.com/maps/search/Osteria%20del%20Sole/@44.4938,11.3426,18z"
    );
  });

  it("le coordinate non sono facoltative: due omonimi si distinguono solo così", () => {
    const bologna = buildDinnerMapUrl("Osteria del Sole", BOLOGNA.lat, BOLOGNA.lon);
    const altrove = buildDinnerMapUrl("Osteria del Sole", 40.5271, 16.0446);
    expect(bologna).not.toBe(altrove);
    expect(altrove).toContain("@40.5271,16.0446");
  });

  it("codifica il nome che comincia con cifre e trattini (051 - Osteria)", () => {
    const url = buildDinnerMapUrl("051 - Osteria", BOLOGNA.lat, BOLOGNA.lon);
    expect(url).toContain("/maps/search/051%20-%20Osteria/@");
    expect(url).not.toContain(" ");
  });

  it("codifica le virgolette nel nome", () => {
    const url = buildDinnerMapUrl('trattoria "Al Vecchio Scarpone"', BOLOGNA.lat, BOLOGNA.lon);
    expect(url).toContain("/maps/search/trattoria%20%22Al%20Vecchio%20Scarpone%22/@");
    expect(url).not.toContain('"');
  });

  it("codifica la barra, che altrimenti spezzerebbe il percorso", () => {
    const url = buildDinnerMapUrl(
      "il Becco Della Civetta -hotel/ristorante",
      40.5271,
      16.0446
    );
    expect(url).toContain("/maps/search/il%20Becco%20Della%20Civetta%20-hotel%2Fristorante/@");
    // Dopo il segmento della ricerca deve restarci una sola barra: quella di "/@".
    expect(url.split("/maps/search/")[1].split("/")).toHaveLength(2);
  });

  it("codifica gli accenti e i caratteri non latini", () => {
    const url = buildDinnerMapUrl("Adega São Nicolau", 41.1421, -8.6136);
    expect(url).toContain(encodeURIComponent("Adega São Nicolau"));
    expect(url).toContain("@41.1421,-8.6136");
  });
});
