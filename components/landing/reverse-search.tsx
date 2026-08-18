"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReverseSearch() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="scopri" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24">
      <motion.div
        className="mx-auto max-w-5xl"
        initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          E se non sai dove andare
        </span>
        <h2 className="mt-3 font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-5xl">
          Parti dal budget, non dalla meta.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-muted-foreground">
          Dicci quanto vuoi spendere, quando parti, da dove e con chi. Ti proponiamo cinque viaggi
          possibili, ognuno con la stima di volo, alloggio e spese sul posto: scegli quello che ti
          convince e da lì costruiamo l&apos;itinerario.
        </p>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="mt-8 gap-2 border-primary px-8 shadow-none has-[>svg]:px-8"
        >
          <Link href="/scopri">
            <Compass className="size-4" />
            Scopri dove puoi andare
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
