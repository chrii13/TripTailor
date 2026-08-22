import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "TripTailor — itinerari di viaggio su misura";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // Fraunces sta già in public/fonts (la usa anche il PDF): niente fetch di
  // rete, si legge il file locale.
  const fraunces = await readFile(
    path.join(process.cwd(), "public", "fonts", "Fraunces-Bold.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1a4d33",
          color: "#ffffff",
          padding: "72px 80px",
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 44,
              height: 6,
              borderRadius: 999,
              backgroundColor: "#f0b429",
            }}
          />
          <div
            style={{
              fontSize: 28,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            TripTailor
          </div>
        </div>

        {/* Due righe esplicite: satori non manda a capo dentro una riga flex. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 92,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>Il tuo itinerario,</div>
          <div style={{ display: "flex", gap: 24 }}>
            <span>cucito</span>
            <span style={{ color: "#f0b429" }}>su misura.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#e4f1dc",
          }}
        >
          Dove, quando e con chi parti. Al resto pensa l&apos;AI.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Fraunces",
          data: fraunces,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
