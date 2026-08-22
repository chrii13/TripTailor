"use client";

import { useEffect } from "react";
import { Geist, Fraunces } from "next/font/google";

import { Button } from "@/components/ui/button";

import "./globals.css";

// Sostituisce il layout radice quando è il layout stesso a fallire: deve
// portarsi dietro <html> e <body>, e non eredita i font caricati in
// `app/layout.tsx`. Vanno quindi richiesti di nuovo qui sia Fraunces (titoli)
// sia Geist: senza `--font-geist-sans` la regola `--default-font-family` del
// CSS compilato decade e il corpo del testo torna al serif del browser.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal"],
  axes: ["opsz"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full items-center justify-center bg-secondary px-4 py-20 text-foreground">
        <div className="w-full max-w-lg rounded-[10px] border border-border bg-background p-8 sm:p-10">
          <p className="font-display text-sm font-[725] tracking-[0.15em] text-muted-foreground uppercase">
            Errore
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[0.9] font-[725] tracking-[-0.03em] text-balance text-primary uppercase sm:text-5xl">
            Qualcosa è andato storto
          </h1>
          <p className="mt-4 text-muted-foreground">
            Il sito non è riuscito a caricarsi. Riprova tra poco.
          </p>
          <Button size="lg" className="mt-8" onClick={reset}>
            Ricarica la pagina
          </Button>

          {error.digest ? (
            <p className="mt-6 text-xs text-muted-foreground">
              Codice errore: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
