"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-primary px-4 py-20 text-primary-foreground sm:px-8 sm:py-28">
      <motion.div
        className="mx-auto flex max-w-5xl flex-col items-start gap-6"
        initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Resta il più grande fra gli h2, ma fluido e sempre sotto l'h1
            dell'hero: con `text-4xl sm:text-6xl` valeva 60px a 700px, contro
            un h1 da 40. */}
        <h2 className="font-display text-[clamp(2.375rem,5.2vw,3.75rem)] leading-[0.9] font-[725] tracking-[-0.015em] text-balance uppercase">
          Pronto a partire?
        </h2>
        <p className="text-primary-foreground/75 sm:text-lg">
          Bastano pochi minuti per avere il tuo piano di viaggio.
        </p>
        {/* Sole, benché l'hero usi Bosco per la stessa azione. Non è una svista:
            qui il fondo è Bosco, quindi un bottone Bosco non esiste e l'unica
            alternativa sarebbe l'inversione su Canvas, che spegne l'ultimo
            richiamo della pagina. Un tentativo di uniformarlo è stato fatto il
            2026-08-23 e respinto dall'utente per questo motivo: la coerenza qui
            costa più di quanto renda. Il divieto di CLAUDE.md riguarda il Sole
            *accanto* a una CTA Sole, non la CTA stessa. */}
        <Button
          asChild
          size="lg"
          className="gap-2 bg-voltage px-8 text-voltage-foreground hover:bg-voltage/90 focus-visible:ring-primary-foreground/70 has-[>svg]:px-8"
        >
          <Link href="/crea">
            Crea il tuo itinerario
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
