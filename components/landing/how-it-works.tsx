"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Racconta il tuo viaggio",
    description:
      "Destinazione, date, chi viaggia, budget e stile: bastano pochi campi.",
  },
  {
    n: "02",
    title: "L'AI costruisce l'itinerario",
    description:
      "Gemini genera un piano giorno per giorno, pensato per il tuo gruppo.",
  },
  {
    n: "03",
    title: "Controlliamo meteo e contesto",
    description:
      "Media storica del clima e informazioni sul paese per ogni tappa del viaggio.",
  },
  {
    n: "04",
    title: "Ricevi il tuo itinerario su misura",
    description:
      "Pronto da consultare e modificare, con tutto il viaggio in un unico posto.",
  },
];

const item: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="come-funziona"
      className="scroll-mt-20 bg-secondary px-4 py-24 sm:px-8 sm:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-12"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-5xl">
            Come funziona
          </h2>
          <p className="mt-3 text-muted-foreground">
            Dal racconto del tuo viaggio all&apos;itinerario pronto, in quattro passi. Vale se la
            meta ce l&apos;hai già in mente: se non ce l&apos;hai, si parte dal budget.
          </p>
        </motion.div>
        <ol className="relative max-w-2xl border-l border-border pl-8">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              className="relative pb-12 last:pb-0"
              initial={reduceMotion ? undefined : "hidden"}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.5 }}
              variants={reduceMotion ? undefined : item}
              transition={{ delay: i * 0.1 }}
            >
              <span className="absolute -left-[37px] top-1.5 size-3 rounded-full border-2 border-secondary bg-voltage" />
              <span className="font-display text-sm font-[725] text-primary">
                {step.n}
              </span>
              <h3 className="mt-1 font-semibold text-primary">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {step.description}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
