"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollProgress } from "./scroll-progress";

const NAV_LINKS = [
  { id: "destinazioni", label: "Destinazioni" },
  { id: "perche", label: "Perché TripTailor" },
  { id: "come-funziona", label: "Come funziona" },
];

export function SiteNav() {
  const [active, setActive] = useState<string | null>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.filter((e) => e.isIntersecting);
        if (inView.length === 0) {
          // sopra la prima sezione: nessuna voce attiva
          if (window.scrollY < window.innerHeight / 2) setActive(null);
          return;
        }
        const top = inView.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        setActive(top.target.id);
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background text-primary">
      <ScrollProgress />
      <div
        className={cn(
          "mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 motion-safe:transition-[height] motion-safe:duration-200 sm:px-8",
          condensed ? "h-[60px]" : "h-[88px]"
        )}
      >
        <a href="#" className="relative shrink-0">
          <span
            className={cn(
              "font-display font-[725] tracking-[0.15em] whitespace-nowrap uppercase motion-safe:transition-[font-size] motion-safe:duration-200",
              condensed ? "text-sm" : "text-lg"
            )}
          >
            TripTailor
          </span>
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-2 left-0 h-[3px] bg-voltage motion-safe:transition-all motion-safe:duration-200",
              condensed ? "w-0 opacity-0" : "w-7 opacity-100"
            )}
          />
        </a>

        <nav
          aria-label="Sezioni della pagina"
          className="flex items-center gap-0.5 rounded-full bg-secondary p-1"
        >
          {NAV_LINKS.map((link) => {
            const isActive = active === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors sm:px-3.5 sm:text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-primary hover:bg-accent"
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <Button
          asChild
          size="sm"
          variant="outline"
          className="hidden border-primary shadow-none sm:inline-flex"
        >
          <Link href="/crea">Crea itinerario</Link>
        </Button>
      </div>
    </header>
  );
}
