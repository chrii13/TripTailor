"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ScrollProgress } from "./scroll-progress";

const NAV_LINKS = [
  { id: "destinazioni", label: "Destinazioni" },
  { id: "perche", label: "Perché TripTailor" },
  { id: "come-funziona", label: "Come funziona" },
  { id: "scopri", label: "Dal budget" },
];

export function SiteNav() {
  const [active, setActive] = useState<string | null>(null);
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        {/* `after:` estende l'area toccabile del logo (il testo da solo è alto
            20px da condensato) a 36px, senza ingrandire il testo né spostare
            nulla: intorno c'è solo spazio vuoto, quindi non si sovrappone ad
            altri bersagli. */}
        <a
          href="#"
          className="relative shrink-0 after:absolute after:-inset-x-2 after:-inset-y-2 after:rounded-full after:content-['']"
        >
          <span
            className={cn(
              "font-display font-[725] tracking-[0.16em] whitespace-nowrap uppercase motion-safe:transition-[font-size] motion-safe:duration-200",
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

        {/* sotto lg le voci non ci stanno in riga: passano nel menu a comparsa */}
        <nav
          aria-label="Sezioni della pagina"
          className="hidden items-center gap-0.5 rounded-full bg-secondary p-1 lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const isActive = active === link.id;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
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

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Sezioni della pagina"
              // Da `sm` il bottone si rimpicciolisce a 32px, ma resta l'unico
              // accesso alle sezioni fino a `lg` — cioè anche sui tablet in
              // verticale (820-834px), dove si tocca col dito. `after:` estende
              // l'area toccabile a 44px senza ingrandire il bottone né l'icona,
              // come già fatto per il logo qui sopra: intorno c'è solo spazio
              // vuoto, il bersaglio più vicino è a ~200px.
              className="relative size-11 border-primary shadow-none sm:size-8 sm:after:absolute sm:after:-inset-1.5 sm:after:rounded-full sm:after:content-[''] lg:hidden"
            >
              <Menu aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-56 rounded-lg border-border p-1 shadow-none lg:hidden"
          >
            <nav aria-label="Sezioni della pagina" className="flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => {
                const isActive = active === link.id;
                return (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-sm transition-colors",
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
            {/* Sotto 640px il bottone "Crea itinerario" della barra è nascosto
                (`hidden sm:inline-flex`): senza questa voce, da telefono la
                barra non porta a /crea in nessun modo. Da `sm` in su il bottone
                c'è già, quindi qui sparisce per non duplicarlo. */}
            <div className="mt-1 border-t border-border pt-1 sm:hidden">
              <Button asChild size="sm" className="w-full">
                <Link href="/crea" onClick={() => setMenuOpen(false)}>
                  Crea itinerario
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

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
