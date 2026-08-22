"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Client component obbligato (Next lo richiede per `reset`): niente `metadata`
// qui, resta quello del layout radice.
export default function Error({
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
    <main className="flex flex-1 items-center justify-center bg-secondary px-4 py-20">
      <div className="w-full max-w-lg rounded-[10px] border border-border bg-background p-8 sm:p-10">
        <p className="font-display text-sm font-[725] tracking-[0.15em] text-muted-foreground uppercase">
          Errore
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[0.9] font-[725] tracking-[-0.03em] text-balance text-primary uppercase sm:text-5xl">
          Qualcosa è andato storto
        </h1>
        <p className="mt-4 text-muted-foreground">
          Si è verificato un problema tecnico da parte nostra. Riprova tra
          poco: i dati che hai inserito potrebbero doversi reinserire.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="gap-2" onClick={reset}>
            <RotateCcw className="size-4" />
            Riprova
          </Button>
          <Button asChild size="lg" variant="outline" className="shadow-none">
            <Link href="/">Torna alla home</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-6 text-xs text-muted-foreground">
            Codice errore: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
