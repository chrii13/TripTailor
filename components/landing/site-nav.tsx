import Link from "next/link";

import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#mete", label: "Mete" },
  { href: "#chi-siamo", label: "Chi siamo" },
  { href: "#come-funziona", label: "Come funziona" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background text-primary">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
        <a
          href="#"
          className="font-display text-sm font-black tracking-[0.15em] uppercase"
        >
          TripTailor
        </a>
        <nav className="flex items-center gap-1 sm:gap-4">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-2 py-1.5 text-xs transition-colors hover:bg-accent sm:px-3 sm:text-sm"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden border-primary shadow-none sm:inline-flex"
          >
            <Link href="/crea">Crea itinerario</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
