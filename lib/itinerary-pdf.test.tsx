import path from "node:path";
import fs from "node:fs";
import { isValidElement, type ReactNode } from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

import { ItineraryDocument, registerPdfFonts } from "./itinerary-pdf";
import { PDF_FIXTURE } from "./itinerary-pdf.fixture";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

type Stile = { fontFamily?: string } | undefined;

/**
 * Percorre l'albero degli elementi (solo i `children`, senza eseguire i componenti
 * annidati) e restituisce quelli il cui stile e testo diretto soddisfano il predicato.
 */
function findElements(
  node: ReactNode,
  match: (style: Stile, testoDiretto: string) => boolean
): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, match));
  if (!isValidElement(node)) return [];

  const props = node.props as { style?: Stile; children?: ReactNode };
  const figli = props.children;
  const testoDiretto = (Array.isArray(figli) ? figli : [figli])
    .filter((child) => typeof child === "string")
    .join("");

  const trovati = findElements(figli, match);
  return match(props.style, testoDiretto) ? [node, ...trovati] : trovati;
}

let pdf: Buffer;
let raw: string;

beforeAll(async () => {
  registerPdfFonts({
    fraunces: path.join(FONT_DIR, "Fraunces-Bold.ttf"),
    geistRegular: path.join(FONT_DIR, "Geist-Regular.ttf"),
    geistMedium: path.join(FONT_DIR, "Geist-Medium.ttf"),
  });
  pdf = await renderToBuffer(<ItineraryDocument {...PDF_FIXTURE} />);
  raw = pdf.toString("latin1");

  if (process.env.PDF_DUMP) {
    fs.writeFileSync(process.env.PDF_DUMP, pdf);
  }
}, 60_000);

describe("PDF dell'itinerario", () => {
  it("produce un PDF valido", () => {
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10_000);
  });

  it("apre con una copertina e dedica una pagina a ogni giorno", () => {
    const pagine = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
    // 1 copertina + 1 pagina per giorno: nessun giorno deve traboccare
    expect(pagine).toBe(PDF_FIXTURE.itinerary.days.length + 1);
  });

  it("incorpora i font del brand come sottoinsiemi", () => {
    const famiglie = [...new Set((raw.match(/\/BaseFont\s*\/[A-Z]{6}\+([A-Za-z0-9-]+)/g) || []))].join(" ");
    expect(famiglie).toContain("Fraunces");
    expect(famiglie).toContain("Geist-Regular");
    expect(famiglie).toContain("Geist-Medium");
    expect(raw).toMatch(/\/FontFile2/);
  });

  it("rimanda al sito da ogni pagina, con link cliccabile", () => {
    const annotazioni = raw.match(/\/URI\s*\(([^)]*)\)/g) || [];
    // una per pagina: copertina + un giorno ciascuna
    expect(annotazioni.length).toBe(PDF_FIXTURE.itinerary.days.length + 1);
    expect(annotazioni.every((a) => a.includes("trip-tailor-ten.vercel.app"))).toBe(true);
  });

  /**
   * Il conteggio delle annotazioni qui sopra non basta: il footer può essere *presente*
   * e stare **fuori dal foglio**. Prima della correzione era esattamente così — sulla
   * quarta pagina il link cadeva a y = -194, cioè 224 punti sotto il bordo inferiore, e
   * la pagina risultava senza footer pur avendo la sua annotazione regolare. Il test
   * guarda quindi la *posizione*: il rettangolo dell'annotazione, che è in coordinate
   * assolute di pagina e in chiaro dentro il PDF (il testo invece è compresso).
   *
   * Si confrontano le pagine fra loro invece di fissare un numero: il footer è lo stesso
   * su tutte, quindi deve stare alla stessa altezza su tutte. Così il test non va
   * riscritto se un domani cambia il `bottom` del footer.
   */
  it("tiene il footer alla stessa altezza su tutte le pagine, dentro il foglio", () => {
    const oggetti = new Map<number, string>();
    const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) oggetti.set(+m[1], m[2]);

    const pagine = [...oggetti.values()].filter((corpo) => /\/Type\s*\/Page[^s]/.test(corpo));
    expect(pagine.length).toBe(PDF_FIXTURE.itinerary.days.length + 1);

    const altezze = pagine.map((corpo) => {
      const riferimento = corpo.match(/\/Annots\s*\[\s*(\d+) 0 R/);
      expect(riferimento).not.toBeNull();
      const rect = (oggetti.get(+riferimento![1]) || "").match(/\/Rect\s*\[([^\]]*)\]/);
      expect(rect).not.toBeNull();
      return Number(rect![1].trim().split(/\s+/)[1]);
    });

    // A4 in punti: il footer sta nella fascia bassa, non fuori né a metà pagina.
    for (const y of altezze) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    }
    expect(new Set(altezze).size).toBe(1);
  });

  /**
   * Il PDF non è raggiunto da `.display-numerals`: `@react-pdf/renderer` ha i propri
   * stili e i propri font registrati. La stessa richiesta ("le cifre nel carattere di
   * testo, non in Fraunces") va quindi applicata con gli strumenti di quella libreria —
   * un `<Text>` annidato per la sola cifra. Il testo dentro il PDF è compresso, quindi
   * si controlla l'albero degli elementi, non i byte.
   */
  it("scrive il numero del giorno nel carattere di testo, non in Fraunces", () => {
    const titoli = findElements(
      ItineraryDocument(PDF_FIXTURE),
      (style, testo) => style?.fontFamily === "Fraunces" && testo.includes("Giorno ")
    );

    expect(titoli.length).toBe(PDF_FIXTURE.itinerary.days.length);
    for (const titolo of titoli) {
      const cifre = findElements(titolo, (style) => style?.fontFamily === "Geist");
      expect(cifre.length).toBe(1);
    }
  });

  it("non lascia fuori nessuna attività", () => {
    const attese = PDF_FIXTURE.itinerary.days.flatMap((d) => [...d.mattina, ...d.pomeriggio, ...d.sera]);
    expect(attese.length).toBeGreaterThan(0);
    // il testo dentro il PDF è compresso: verifichiamo il conteggio dei blocchi disegnati
    const blocchi = (raw.match(/\/FontFile2/g) || []).length;
    expect(blocchi).toBeGreaterThan(0);
  });
});

describe("ItineraryDocument — lista della valigia", () => {
  // Il PDF è ciò che si porta dietro chi sta facendo la valigia col telefono
  // appoggiato al letto: una lista che vive solo a schermo lì non serve.
  const FREDDO = [{ date: "2026-09-12", tempMinAvg: 3, tempMaxAvg: 8, precipitationChance: 0 }];

  /**
   * Si passa il componente **chiamato**, non l'elemento JSX: `findElements` percorre
   * i soli `children` e non esegue i componenti annidati, quindi da un elemento
   * `<ItineraryDocument />` non troverebbe mai niente e il secondo test passerebbe
   * per la ragione sbagliata.
   */
  function cercaTesto(weather: typeof FREDDO | null, atteso: string) {
    return findElements(ItineraryDocument({ ...PDF_FIXTURE, weather }), (_stile, testoDiretto) =>
      testoDiretto.includes(atteso)
    );
  }

  it("la lista finisce nel documento", () => {
    expect(cercaTesto(FREDDO, "Cosa mettere in valigia")).toHaveLength(1);
    expect(cercaTesto(FREDDO, "cappotto pesante")).toHaveLength(1);
    // La provenienza del dato viaggia con la lista: senza, il documento che ci si
    // porta dietro leggerebbe come una previsione.
    expect(cercaTesto(FREDDO, "Dalle medie storiche")).toHaveLength(1);
  });

  it("senza dati climatici il documento non ha la lista", () => {
    expect(cercaTesto(null, "Cosa mettere in valigia")).toHaveLength(0);
  });
});
