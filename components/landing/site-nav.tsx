const NAV_LINKS = [
  { href: "#mete", label: "Mete" },
  { href: "#chi-siamo", label: "Chi siamo" },
  { href: "#come-funziona", label: "Come funziona" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-8">
        <a
          href="#"
          className="font-display text-sm font-semibold tracking-[0.15em] uppercase"
        >
          TripTailor
        </a>
        <nav className="flex items-center gap-4 text-xs sm:gap-6 sm:text-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="opacity-90 transition-opacity hover:opacity-100"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
