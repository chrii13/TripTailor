"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCost, REVERSE_SEARCH_DESTINATIONS } from "./reverse-search-destinations";

export function ReverseSearch() {
  const reduceMotion = useReducedMotion();
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
          <div className="scopri-marquee-track flex w-max items-center gap-3">
            {chips.map((dest, i) => (
              <span
                key={`${dest.id}-${i}`}
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
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-accent to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-accent to-transparent" />
        </div>

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
