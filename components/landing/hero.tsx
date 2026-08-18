"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ItineraryPreview } from "./itinerary-preview";

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
      <motion.div
        className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
        variants={reduceMotion ? undefined : container}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "visible"}
      >
        <div className="flex flex-col items-start gap-6">
          <motion.span
            variants={reduceMotion ? undefined : item}
            className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
          >
            Itinerari su misura, generati dall&apos;AI
          </motion.span>
          <motion.h1
            variants={reduceMotion ? undefined : item}
            className="font-display text-[clamp(2.5rem,5.5vw,4rem)] leading-[0.9] font-[725] tracking-[-0.015em] text-balance text-primary uppercase"
          >
            Il tuo itinerario, cucito su misura.
          </motion.h1>
          <motion.p
            variants={reduceMotion ? undefined : item}
            className="max-w-md text-balance text-muted-foreground sm:text-lg"
          >
            Racconta dove, quando e con chi parti. L&apos;AI disegna il resto,
            giorno per giorno, sul tuo budget e sul meteo del periodo.
          </motion.p>
          <motion.div
            variants={reduceMotion ? undefined : item}
            className="flex flex-wrap items-center gap-6"
          >
            <Button asChild size="lg" className="gap-2 px-8 has-[>svg]:px-8">
              <Link href="/crea">
                Crea il tuo itinerario
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="#come-funziona"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Guarda come funziona
            </Link>
          </motion.div>
        </div>
        <motion.div variants={reduceMotion ? undefined : item}>
          <ItineraryPreview />
        </motion.div>
      </motion.div>
    </section>
  );
}
