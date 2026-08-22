"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCost, REVERSE_SEARCH_DESTINATIONS } from "./reverse-search-destinations";

export function ReverseSearch() {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const chips = [...REVERSE_SEARCH_DESTINATIONS, ...REVERSE_SEARCH_DESTINATIONS];

  return (
    <section id="scopri" className="scroll-mt-20 bg-accent px-4 py-16 sm:px-8 sm:py-24">
      <motion.div
        className="mx-auto max-w-5xl"
        initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span aria-hidden className="block h-[3px] w-7 rounded-full bg-voltage" />
        <span className="mt-3 block text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          E se non sai dove andare
        </span>
        <h2 className="mt-3 font-display text-3xl font-[725] tracking-[-0.01em] text-primary uppercase sm:text-5xl">
          Parti dal <span className="emphasis-mark-display">budget</span>, non dalla meta.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-foreground">
          Dicci quanto puoi spendere, quando vorresti partire e con chi. Ti mostriamo 5 possibili
          proposte di viaggio, ognuna con quanto costa arrivarci, dormirci e viverci. Scegli, e
          all&apos;itinerario ci pensiamo noi.
        </p>

        <div aria-hidden className="scopri-marquee relative mt-8 overflow-hidden">
          <div
            className="scopri-marquee-track flex w-max items-center gap-3"
            data-paused={paused ? "" : undefined}
          >
            {chips.map((dest, i) => (
              <span
                key={`${dest.id}-${i}`}
                data-marquee-duplicate={
                  i >= REVERSE_SEARCH_DESTINATIONS.length ? "" : undefined
                }
                className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background py-1.5 pr-4 pl-1.5"
              >
                <dest.Flag className="h-4 w-6 shrink-0 rounded-[2px]" />
                <span className="text-sm font-medium text-foreground">{dest.city}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  ~{formatCost(dest.cost)} €
                </span>
              </span>
            ))}
          </div>
          <div className="scopri-marquee-fade pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-accent to-transparent" />
          <div className="scopri-marquee-fade pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-accent to-transparent" />
        </div>

        {/* Comando di pausa richiesto da WCAG 2.2.2: il nastro dura più di 5s,
            parte da solo e si ripete. Con `prefers-reduced-motion` non serve (il
            nastro è già fermo e disposto su più righe) e sparisce via CSS, non
            via JavaScript: `useReducedMotion()` vale sempre false sul server,
            quindi renderlo condizionalmente cambierebbe la struttura del DOM
            fra HTML servito e prima render client — un errore di idratazione. */}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="scopri-marquee-pause mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {paused ? (
            <Play aria-hidden="true" className="size-3.5" />
          ) : (
            <Pause aria-hidden="true" className="size-3.5" />
          )}
          {paused ? "Riprendi lo scorrimento" : "Metti in pausa lo scorrimento"}
        </button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="mt-8 gap-2 border-primary px-8 shadow-none has-[>svg]:px-8"
        >
          <Link href="/scopri">
            <Compass aria-hidden="true" className="size-4" />
            Scopri dove puoi andare
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
