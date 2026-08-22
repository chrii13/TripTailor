import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  // Il suffisso lo aggiunge il `title.template` del layout radice.
  title: "Pagina non trovata",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-secondary px-4 py-20">
      <div className="w-full max-w-lg rounded-[10px] border border-border bg-background p-8 sm:p-10">
        <p className="font-display text-sm font-[725] tracking-[0.15em] text-muted-foreground uppercase">
          Errore 404
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[0.9] font-[725] tracking-[-0.03em] text-balance text-primary uppercase sm:text-5xl">
          Questa pagina non esiste
        </h1>
        <p className="mt-4 text-muted-foreground">
          L&apos;indirizzo è sbagliato, oppure la pagina non c&apos;è più. Da
          qui puoi ripartire.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Torna alla home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="shadow-none">
            <Link href="/crea">Crea un itinerario</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="shadow-none">
            <Link href="/scopri">Parti dal budget</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
