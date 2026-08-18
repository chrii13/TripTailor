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
        <h2 className="font-display text-4xl leading-[0.9] font-[725] tracking-[-0.015em] text-balance uppercase sm:text-6xl">
          Pronto a partire?
        </h2>
        <p className="text-primary-foreground/75 sm:text-lg">
          Bastano pochi minuti per avere il tuo piano di viaggio.
        </p>
        <Button
          asChild
          size="lg"
          className="gap-2 bg-voltage px-8 text-voltage-foreground hover:bg-voltage/90 focus-visible:ring-primary-foreground/70 has-[>svg]:px-8"
        >
          <Link href="/crea">
            Crea il tuo itinerario
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
