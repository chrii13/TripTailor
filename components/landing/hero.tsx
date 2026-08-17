"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteLine } from "./route-line";

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
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)] px-4 pt-20 pb-16 sm:px-8 sm:pt-28 sm:pb-24">
      <motion.div
        className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
        variants={reduceMotion ? undefined : container}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "visible"}
      >
        <motion.span
          variants={reduceMotion ? undefined : item}
          className="font-display text-sm font-semibold tracking-[0.2em] text-primary uppercase"
        >
          TripTailor
        </motion.span>
        <motion.h1
          variants={reduceMotion ? undefined : item}
          className="font-display text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl md:text-6xl"
        >
          Il tuo itinerario, cucito su misura.
        </motion.h1>
        <motion.p
          variants={reduceMotion ? undefined : item}
          className="max-w-xl text-balance text-muted-foreground sm:text-lg"
        >
          Racconta dove, quando e con chi parti. L&apos;AI disegna il resto,
          giorno per giorno, sul tuo budget e sul meteo del periodo.
        </motion.p>
        <motion.div variants={reduceMotion ? undefined : item}>
          <Button asChild size="lg" className="gap-2 px-8">
            <Link href="/crea">
              Crea il tuo itinerario
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </motion.div>
        <motion.div variants={reduceMotion ? undefined : item} className="w-full pt-4">
          <RouteLine />
        </motion.div>
      </motion.div>
    </section>
  );
}
