"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-accent"
    >
      <motion.div
        className="h-full origin-left bg-primary"
        style={{ scaleX: reduceMotion ? scrollYProgress : smooth }}
      />
    </div>
  );
}
