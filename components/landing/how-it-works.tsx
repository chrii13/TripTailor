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

// Il ritardo progressivo sta dentro la variante, non nella prop `transition`
// del componente: in Framer Motion la transizione dichiarata nella variante
// scavalca del tutto quella passata come prop, quindi un `delay` là fuori è
// codice morto e i quattro passi entrano insieme. Con `custom={i}` la variante
// diventa una funzione e il ritardo agisce davvero.
const item: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="come-funziona"
      className="scroll-mt-20 bg-secondary px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-10"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Scala fluida come l'h1 e con un tetto più basso: con
              `text-3xl sm:text-5xl` l'h2 saltava di netto da 30 a 48px a 640px
              e restava più grande dell'h1 (fluido) su tutta la fascia
              640–873px, invertendo la gerarchia. */}
          <h2 className="font-display text-[clamp(2rem,4.6vw,3rem)] font-[725] tracking-[-0.015em] text-primary uppercase">
            Come funziona
          </h2>
          {/* Unico paragrafo della landing senza limite di misura: senza il tetto
              arrivava a 692px a 768, 758 a 834 e 948 (una riga sola, 146 caratteri)
              da 1024 in su, cioè 100-146 caratteri per riga contro i 65-75 leggibili.
              Il tetto è in `ch` perché segua la dimensione del testo, ma va tarato
              sul carattere: lo zero di Geist è largo 0,66em, molto più del carattere
              medio di un testo italiano, quindi 65ch qui varrebbe 690px e non
              vincolerebbe nulla. 54ch = 573px, la stessa misura dei `max-w-xl` già
              in uso nelle altre sezioni. */}
          <p className="mt-3 max-w-[54ch] text-muted-foreground">
            Dal racconto del tuo viaggio all&apos;itinerario pronto, in quattro passi. Vale se la
            meta ce l&apos;hai già in mente: se non ce l&apos;hai, si parte dal budget.
          </p>
        </motion.div>
        <ol className="relative ml-2 max-w-2xl border-l border-border pl-8 sm:ml-0">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              custom={i}
              className="relative pb-10 last:pb-0"
              initial={reduceMotion ? undefined : "hidden"}
              whileInView={reduceMotion ? undefined : "visible"}
              viewport={{ once: true, amount: 0.5 }}
              variants={reduceMotion ? undefined : item}
            >
              <span className="absolute -left-[37px] top-1.5 size-3 rounded-full border-2 border-secondary bg-voltage" />
              {/* Solo cifre: la classe va sull'elemento, non serve un wrapper. */}
              <span className="display-numerals text-sm font-[725] text-primary">
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
