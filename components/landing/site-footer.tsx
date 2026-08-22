import Link from "next/link";

const REPO = "https://github.com/chrii13/TripTailor";

const NAVIGA = [
  { href: "#destinazioni", label: "Destinazioni" },
  { href: "#perche", label: "Perché TripTailor" },
  { href: "#come-funziona", label: "Come funziona" },
  { href: "/crea", label: "Crea il tuo itinerario" },
];

const FONTI = [
  { cosa: "Itinerari", chi: "Google Gemini" },
  { cosa: "Clima", chi: "Open-Meteo", nota: "media degli ultimi 5 anni, non una previsione" },
  { cosa: "Luoghi", chi: "LocationIQ" },
];

function ColonnaTitolo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-background px-4 pt-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <span aria-hidden className="block h-[3px] w-7 bg-voltage" />
        <p className="mt-3 font-display text-sm font-[725] tracking-[0.15em] text-primary uppercase">
          TripTailor
        </p>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-8 lg:grid-cols-4">
          <div>
            <ColonnaTitolo>Naviga</ColonnaTitolo>
            <ul className="flex flex-col gap-1.5 text-sm">
              {NAVIGA.map((voce) => (
                <li key={voce.href}>
                  <Link
                    href={voce.href}
                    className="inline-block py-3 text-primary underline-offset-4 sm:py-1.5 hover:underline"
                  >
                    {voce.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ColonnaTitolo>Da dove vengono i dati</ColonnaTitolo>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {FONTI.map((fonte) => (
                <li key={fonte.cosa}>
                  <span className="font-medium text-primary">{fonte.cosa}</span> — {fonte.chi}
                  {fonte.nota && (
                    <span className="block text-xs">{fonte.nota}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ColonnaTitolo>Dati personali</ColonnaTitolo>
            <p className="text-sm text-muted-foreground">
              Nessun account e nulla viene salvato. Destinazione, date e composizione del
              gruppo vengono inviati a Google Gemini solo per generare l&apos;itinerario.
            </p>
          </div>

          <div>
            <ColonnaTitolo>Progetto</ColonnaTitolo>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li>
                <a
                  href={`${REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-3 text-primary underline-offset-4 sm:py-1.5 hover:underline"
                >
                  Segnala un problema
                </a>
              </li>
              <li>
                <a
                  href={REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-3 text-primary underline-offset-4 sm:py-1.5 hover:underline"
                >
                  Codice sorgente
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-border py-5 text-xs text-muted-foreground">
          <span>TripTailor — progetto personale</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
