"use client";

import { motion, useReducedMotion } from "framer-motion";

export function SiteIdentity() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="perche"
      className="scroll-mt-20 bg-primary px-4 py-20 text-primary-foreground sm:px-8 sm:py-28"
    >
      <motion.div
        className="mx-auto max-w-5xl"
        initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* h2 e non <p>: la voce di menu "Perché TripTailor" punta a questa
            sezione, che era l'unica della landing senza intestazione. Le classi
            sono invariate, la resa visiva è identica. */}
        <h2 className="max-w-3xl font-display text-[clamp(2rem,4.6vw,3rem)] leading-[1.15] font-[725] tracking-[-0.015em] text-balance text-voltage">
          Niente più tab aperte tra mappe, meteo e fogli di calcolo.
        </h2>
        <p className="mt-8 max-w-xl text-primary-foreground/75 sm:text-lg">
          Un unico posto per trasformare destinazione, date, gruppo e budget
          in un itinerario giorno per giorno — pensato per il tuo viaggio, non
          per il viaggiatore medio.
        </p>
      </motion.div>
    </section>
  );
}
