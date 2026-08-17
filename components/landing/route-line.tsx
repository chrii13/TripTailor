"use client";

import { motion, useReducedMotion } from "framer-motion";

const MARKERS = [
  { cx: 20, cy: 70 },
  { cx: 200, cy: 35 },
  { cx: 360, cy: 50 },
  { cx: 540, cy: 20 },
  { cx: 700, cy: 60 },
];

export function RouteLine() {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      viewBox="0 0 720 100"
      className="mx-auto h-14 w-full max-w-md text-primary sm:h-16 sm:max-w-xl"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d="M20 70 C 160 20, 260 90, 360 50 S 560 10, 700 60"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="1 12"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 1.6, ease: "easeInOut", delay: 0.3 }
        }
      />
      {MARKERS.map((marker, i) => (
        <motion.circle
          key={`${marker.cx}-${marker.cy}`}
          cx={marker.cx}
          cy={marker.cy}
          r={5}
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { delay: 0.5 + i * 0.32, duration: 0.35, ease: "backOut" }
          }
        />
      ))}
    </svg>
  );
}
