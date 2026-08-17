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
      className="scroll-mt-20 bg-secondary/40 px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            Come funziona
          </h2>
          <p className="mt-2 text-muted-foreground">
            Dal racconto del tuo viaggio all&apos;itinerario pronto, in
            quattro passi.
          </p>
        </div>
        <ol className="relative border-l-2 border-dashed border-border pl-8">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              className="relative pb-10 last:pb-0"
              initial={reduceMotion ? undefined : "hidden"}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.5 }}
              variants={reduceMotion ? undefined : item}
              transition={{ delay: i * 0.1 }}
            >
              <span className="absolute -left-[37px] top-1 size-2.5 rounded-full bg-primary" />
              <span className="font-display text-sm font-semibold text-primary">
                {step.n}
              </span>
              <h3 className="mt-1 font-medium">{step.title}</h3>
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
