"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { CloudSun, Sun, Users } from "lucide-react";

const DAYS = [
  {
    label: "Giorno 1",
    weather: { icon: "sun" as const, temp: "24°" },
    stops: [
      { time: "09:30", title: "Torre di Belém", note: "Biglietto salta-fila" },
      { time: "13:00", title: "Pranzo a Time Out Market", note: "~18 € a testa" },
      { time: "17:00", title: "Tram 28 fino ad Alfama", note: "Tramonto dal Portas do Sol" },
    ],
  },
  {
    label: "Giorno 2",
    weather: { icon: "cloud" as const, temp: "21°" },
    stops: [
      { time: "10:00", title: "Sintra, Palácio da Pena", note: "Treno da Rossio, 40 min" },
      { time: "15:30", title: "Quinta da Regaleira", note: "Pozzo iniziatico" },
    ],
  },
];

const WEATHER_ICONS = { sun: Sun, cloud: CloudSun };

const list: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13, delayChildren: 0.75 } },
};

const stop: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function ItineraryPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary px-5 py-4">
        <div>
          <p className="font-display text-lg font-[725] tracking-[-0.005em] text-primary">
            Lisbona
          </p>
          <p className="text-xs text-muted-foreground">
            12–13 settembre · 2 giorni
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Users className="size-3.5" />2 adulti
        </span>
      </div>

      <motion.div
        className="divide-y divide-border"
        variants={reduceMotion ? undefined : list}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "visible"}
      >
        {DAYS.map((day) => {
          const WeatherIcon = WEATHER_ICONS[day.weather.icon];
          return (
            <div key={day.label} className="px-5 py-4">
              <motion.div
                className="mb-3 flex items-center justify-between"
                variants={reduceMotion ? undefined : stop}
              >
                <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {day.label}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <WeatherIcon className="size-4" />
                  {day.weather.temp}
                </span>
              </motion.div>
              <ol className="space-y-3">
                {day.stops.map((s) => (
                  <motion.li
                    key={s.time}
                    className="flex gap-3"
                    variants={reduceMotion ? undefined : stop}
                  >
                    <span className="w-11 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {s.time}
                    </span>
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-voltage" />
                    <span>
                      <span className="block text-sm font-medium text-primary">
                        {s.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {s.note}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          );
        })}
      </motion.div>

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Esempio generato da TripTailor — il tuo sarà diverso.
      </p>
    </div>
  );
}
