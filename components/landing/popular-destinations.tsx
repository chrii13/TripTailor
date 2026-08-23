"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Building2,
  Landmark,
  Mountain,
  Palmtree,
  Sparkles,
  Sun,
  TreePine,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  POPULAR_DESTINATIONS,
  type PopularDestinationIcon,
} from "@/lib/popular-destinations";

const ICONS: Record<PopularDestinationIcon, LucideIcon> = {
  landmark: Landmark,
  waves: Waves,
  mountain: Mountain,
  palmtree: Palmtree,
  building: Building2,
  sun: Sun,
  sparkles: Sparkles,
  treePine: TreePine,
};

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function PopularDestinations() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="destinazioni" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-10"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="font-display text-[clamp(2rem,4.6vw,3rem)] font-[725] tracking-[-0.015em] text-primary uppercase">
            Le mete più <span className="emphasis-mark-display">gettonate</span>
          </h2>
          {/* La riga precedente ("Da dove partono di solito i nostri viaggiatori")
              era sbagliata due volte: diceva "partono" mentre le card mostrano dove
              si arriva, e prometteva un'abitudine collettiva che un sito senza
              account non può conoscere. Sostituita il 2026-08-23 con l'istruzione
              vera: le card sono cliccabili e precompilano /crea, ma niente lo diceva. */}
          <p className="mt-3 text-muted-foreground">
            Tocca una meta: il form si compila da solo.
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          variants={reduceMotion ? undefined : container}
          initial={reduceMotion ? undefined : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.3 }}
        >
          {POPULAR_DESTINATIONS.map((destination) => {
            const Icon = ICONS[destination.icon];
            return (
              <motion.div
                key={destination.name}
                variants={reduceMotion ? undefined : item}
              >
                <Link
                  href={`/crea?destination=${encodeURIComponent(destination.query)}`}
                  className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {/* `rounded-lg` = --radius (10px): la <Card> di shadcn nasce
                      `rounded-xl`, cioè 14px, mentre il sistema dichiara 10px
                      per card e input come nel resto dell'app. */}
                  <Card className="h-full gap-3 rounded-lg border-border py-5 shadow-none transition-colors hover:border-primary hover:bg-accent">
                    <CardContent className="flex flex-col items-center gap-2 px-4 text-center">
                      {/* decorativa: nome, paese e badge dicono già tutto */}
                      <Icon aria-hidden="true" className="size-6 text-primary" />
                      <div>
                        <p className="font-medium">{destination.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {destination.country}
                        </p>
                      </div>
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
                        {destination.badge}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
