"use client";

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
    <section id="mete" className="scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] text-primary uppercase sm:text-5xl">
            Le mete più gettonate
          </h2>
          <p className="mt-3 text-muted-foreground">
            Da dove partono di solito i nostri viaggiatori.
          </p>
        </div>
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
                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="h-full gap-3 border-border py-5 shadow-none">
                  <CardContent className="flex flex-col items-center gap-2 px-4 text-center">
                    <Icon className="size-6 text-primary" />
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
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
