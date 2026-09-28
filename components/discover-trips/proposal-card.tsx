import Link from "next/link";
import { ArrowRight, CalendarDays, Info, MapPin, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TripProposal } from "@/lib/discover-trips-schema";
import { roundProposalCosts } from "@/lib/round-proposal-costs";
import { buildRealPriceSearchUrl } from "@/lib/real-price-search-link";
import { formatSuggestedWindowLabel } from "@/lib/discover-trips-suggested-window-label";

interface ProposalCardProps {
  proposal: TripProposal;
  href: string;
  budget: number;
  travelerCount: number;
  nights: number;
  departureCity: string;
  departureDate?: Date;
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatApprox(value: number): string {
  return `~${euro.format(value)}`;
}

/**
 * Le due cifre "a persona" della card (il viaggio A/R e il totale) NON sono
 * quelle restituite dal modello: il modello sbaglia questa moltiplicazione (può
 * dire "120 a persona" e "200 in totale" per quattro persone) e il server non la
 * verifica, così come non si fida del `total` del modello e lo ricalcola dalle
 * voci. Si ricavano quindi dalla cifra verificata — il totale già mostrato —
 * invece di scartare la proposta: stessa scelta clemente già fatta per `total`
 * in `verifyProposalsAgainstBudget`, che ricalcola e tiene la proposta anziché
 * eliminarla.
 *
 * Divisione arrotondata all'euro, non alla cinquantina: il totale da cui parte
 * è già arrotondato, e un secondo arrotondamento a passo largo rimetterebbe le
 * due cifre in contraddizione (700 / 3 → 250, che per tre fa 750 accanto a un
 * totale di 700). All'euro lo scarto residuo resta di pochi centesimi di euro
 * per persona, non di cinquanta.
 */
export function derivePerPerson(total: number, travelerCount: number): number {
  return Math.round(total / travelerCount);
}

/**
 * Il budget regge un confronto? Un predicato, non una percentuale, ed e' un
 * cambio voluto.
 *
 * Fino a oggi questa era `budgetUsagePercent`: calcolava la quota di budget, la
 * arrotondava e la limitava a 100. Quel numero lo disegnava la barra dentro la
 * scheda, e la barra e' stata tolta perche' leggeva come una barra di
 * caricamento. Da allora **nessuno leggeva piu' il numero**: della risposta
 * serviva solo il `null`. Arrotondamento e tetto erano diventati logica morta
 * con sei test verdi addosso, che e' peggio di nessun test — danno credito a
 * codice che non protegge niente di visibile.
 *
 * Ora dice quello che serve davvero, e serve a non scrivere "su NaN euro"
 * nella riga dei conti.
 */
export function budgetIsComparable(budget: number): boolean {
  return Number.isFinite(budget) && budget > 0;
}

export function ProposalCard({
  proposal,
  href,
  budget,
  travelerCount,
  nights,
  departureCity,
  departureDate,
}: ProposalCardProps) {
  const costs = roundProposalCosts(proposal.costs);
  const suggestedWindow = formatSuggestedWindowLabel(proposal);
  // Nessun terzo arrotondamento su questa differenza: totale e budget sono
  // entrambi scritti a schermo, uno accanto all'altro, e il lettore li sottrae.
  // Riarrotondarla alla cinquantina rimetterebbe le due cifre in contraddizione
  // ("~785 € su 1.200 €" con "ti restano ~400 €" fa 1.185), che è lo stesso
  // difetto già corretto su `derivePerPerson`: una cifra già arrotondata non si
  // arrotonda una seconda volta. Il "~" resta perché gli operandi sono stime.
  const remaining = budget - costs.total;
  const travelPerPerson = derivePerPerson(costs.travelTotal, travelerCount);
  const perPerson = travelerCount > 1 ? derivePerPerson(costs.total, travelerCount) : null;
  const budgetConfrontabile = budgetIsComparable(budget);
  const realPriceSearchUrl = departureDate
    ? buildRealPriceSearchUrl(departureCity, proposal.destination, departureDate, proposal.country)
    : null;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border pb-0 shadow-none">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6 pb-6">
        <div>
          {/* Nome e prezzo sulla stessa riga: sono le due cose che si
              confrontano fra sei schede, e finora il totale era sepolto in
              fondo alla tabella dei costi. */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-[725] tracking-[-0.01em] text-primary uppercase">
              {proposal.destination}
            </h2>
            <div className="shrink-0 text-right">
              {/* Un gradino sotto il nome (text-lg contro text-xl): la cifra
                  resta forte ma non contende il comando all'intestazione.
                  formatApprox dà solo cifre e simboli ("~1.250 €"): nessuna
                  lettera da tenere in Fraunces, la classe va sull'elemento.
                  "Totale" era un <dt> nella tabella di prima ed è caduto con
                  essa: a schermo lo dice la posizione, ma chi ascolta sentiva
                  "Lisbona, circa mille euro" senza sapere di cosa — e quando la
                  barra non si disegna sparisce anche il "su X €" accanto. */}
              {/* L'avvertenza per intero sta nel piede, ma il numero si legge
                  qui, e chi salta al prezzo non arriva mai in fondo. La tilde da
                  sola non basta: quasi nessuno la decodifica come 'stima'.

                  Sta **prima** della cifra e non sotto: un maiuscoletto piccolo
                  etichetta cio' che segue, e sotto avrebbe avuto due candidati
                  (il totale e il 'a persona'), qualificandoli entrambi a meta'. */}
              <p className="font-display text-[10px] font-[725] tracking-[0.16em] text-muted-foreground uppercase">
                Stima AI
              </p>
              <p className="display-numerals text-lg font-[725] text-primary">
                <span className="sr-only">Totale </span>
                {formatApprox(costs.total)}
              </p>
              {perPerson !== null && (
                <p className="text-xs text-muted-foreground">
                  {formatApprox(perPerson)} a persona
                </p>
              )}
            </div>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {proposal.country}
            </span>
            <span className="flex items-center gap-1.5">
              <Moon className="size-3.5" />
              {nights === 0 ? "in giornata" : `${nights} ${nights === 1 ? "notte" : "notti"}`}
            </span>
            {suggestedWindow && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Consigliato {suggestedWindow}
              </span>
            )}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{proposal.whyItFits}</p>

        <ul className="space-y-1.5 text-sm text-primary">
          {proposal.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-voltage" />
              {highlight}
            </li>
          ))}
        </ul>

        {/* Fascia Nebbia che chiude la card, come la CTA di /crea e /scopri:
            tutto quel che riguarda le cifre — quanto costa sul budget, come si
            scompone, quanto vale la stima — sta insieme sotto il racconto della
            meta, invece di essere sparso fra corpo e fondo. La barra che stava
            qui sopra è sparita: leggeva come una barra di caricamento e diceva
            in figura quello che la prima riga dice in parole. */}
        {/* bg-accent e non bg-secondary: su /scopri il fondo della pagina E' gia'
            Nebbia, misurato rgb(236,239,233) identico, quindi un piede Nebbia
            faceva sparire meta' scheda nella pagina, tenuta solo da un bordo di
            un pixel. Su /crea la stessa fascia funziona perche' li' il fondo e'
            diverso: non copiare quella scelta qui senza guardare. */}
        <div className="-mx-6 -mb-6 mt-auto space-y-3 border-t border-border bg-accent px-6 pt-4 pb-6">
          {/* Senza questa guardia, con un budget a zero o non numerico la riga
              scriverebbe "su NaN euro". Il predicato dice esattamente questo e
              niente di piu': vedi budgetIsComparable. */}
          {budgetConfrontabile && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>
                {formatApprox(costs.total)} su {euro.format(budget)}
              </span>
              {remaining > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>ti restano {formatApprox(remaining)}</span>
                </>
              )}
            </p>
          )}

          {/* Le tre voci su una riga sola: restano leggibili e smettono di
              essere protagoniste, ora che il totale sta in cima. Nessuna
              informazione persa rispetto alla tabella di prima, compreso il
              "a persona" del viaggio A/R. */}
          <p className="text-xs text-muted-foreground">
            Viaggio A/R {formatApprox(costs.travelTotal)}
            {/* Il "a persona" del viaggio solo con piu' di un viaggiatore: da soli
                ripeterebbe la stessa cifra a due parole di distanza ("~85 € (~85 € a
                persona)"), che e' rumore e fa dubitare di aver letto male. Stessa
                condizione gia' in vigore per il totale a persona, qui sopra. */}
            {travelerCount > 1 && ` (${formatApprox(travelPerPerson)} a persona)`} ·{" "}
            Alloggio {formatApprox(costs.lodgingTotal)} · In loco{" "}
            {formatApprox(costs.onSiteTotal)}
          </p>

          {/* La liberatoria era salita una volta sola sopra la griglia, e da lì
              chi scorre fino alla quarta scheda non la vede più: legge "~1.350 €"
              come un prezzo. Torna nella scheda — dove stanno le cifre di cui
              parla — e in cambio sparisce da sopra la griglia, così resta detta
              una volta per ogni schermata di lettura e non sette volte insieme.
              Il link è sempre stato qui, perché è specifico della meta. */}
          <p className="flex gap-2 pt-2 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Stime generate dall&apos;AI, non prezzi prenotabili: nessun prezzo reale è stato consultato, e quelli veri cambiano con la data e la disponibilità.
              {realPriceSearchUrl && (
                <>
                  {" "}
                  <a
                    href={realPriceSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    Verifica i prezzi reali
                  </a>
                </>
              )}
            </span>
          </p>

          <Button asChild variant="outline" className="w-full gap-2 border-primary shadow-none">
            <Link href={href}>
              Crea l&apos;itinerario
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
