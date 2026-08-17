"use client";

import { motion, useReducedMotion } from "framer-motion";

export function SiteIdentity() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="chi-siamo" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-20">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <p className="font-display text-2xl leading-snug font-medium text-balance italic sm:text-3xl">
          &ldquo;Niente più tab aperte tra mappe, meteo e fogli di calcolo.
          Racconti il viaggio che vuoi fare, TripTailor lo mette in
          ordine.&rdquo;
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Un unico posto per trasformare destinazione, date, gruppo e budget
          in un itinerario giorno per giorno — pensato per il tuo viaggio, non
          per il viaggiatore medio.
        </p>
      </motion.div>
    </section>
  );
}
