"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollProgress } from "./scroll-progress";

const NAV_LINKS = [
  { id: "mete", label: "Mete" },
  { id: "chi-siamo", label: "Chi siamo" },
  { id: "come-funziona", label: "Come funziona" },
];

export function SiteNav() {
  const [active, setActive] = useState<string | null>(null);

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
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <a
          href="#"
          className="font-display text-sm font-[725] tracking-[0.15em] whitespace-nowrap uppercase"
        >
          TripTailor
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
