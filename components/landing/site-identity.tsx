"use client";

import { motion, useReducedMotion } from "framer-motion";

export function SiteIdentity() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="perche"
      className="scroll-mt-20 bg-primary px-4 py-28 text-primary-foreground sm:px-8 sm:py-40"
    >
      <motion.div
        className="mx-auto max-w-5xl"
        initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <p className="max-w-3xl font-display text-3xl leading-[1.15] font-[725] tracking-[-0.01em] text-balance text-voltage sm:text-5xl">
          Niente più tab aperte tra mappe, meteo e fogli di calcolo.
        </p>
        <p className="mt-10 max-w-xl text-primary-foreground/75 sm:text-lg">
          Un unico posto per trasformare destinazione, date, gruppo e budget
          in un itinerario giorno per giorno — pensato per il tuo viaggio, non
          per il viaggiatore medio.
        </p>
      </motion.div>
    </section>
  );
}
