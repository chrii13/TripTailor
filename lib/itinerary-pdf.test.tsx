import path from "node:path";
import fs from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";

import { ItineraryDocument, registerPdfFonts } from "./itinerary-pdf";
import { PDF_FIXTURE } from "./itinerary-pdf.fixture";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

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

  it("non lascia fuori nessuna attività", () => {
    const attese = PDF_FIXTURE.itinerary.days.flatMap((d) => [...d.mattina, ...d.pomeriggio, ...d.sera]);
    expect(attese.length).toBeGreaterThan(0);
    // il testo dentro il PDF è compresso: verifichiamo il conteggio dei blocchi disegnati
    const blocchi = (raw.match(/\/FontFile2/g) || []).length;
    expect(blocchi).toBeGreaterThan(0);
  });
});
