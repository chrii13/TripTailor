"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-border px-4 py-16 text-center sm:px-8 sm:py-20">
      <motion.div
        className="mx-auto flex max-w-xl flex-col items-center gap-4"
        initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">
          Pronto a partire?
        </h2>
        <Button asChild size="lg" className="gap-2 px-8">
          <Link href="/crea">
            Crea il tuo itinerario
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          Bastano pochi minuti per avere il tuo piano di viaggio.
        </p>
      </motion.div>
    </section>
  );
}
