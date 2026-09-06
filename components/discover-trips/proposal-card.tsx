import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TripProposal } from "@/lib/discover-trips-schema";
import { roundProposalCosts, roundToNearestFifty } from "@/lib/round-proposal-costs";
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
 * Quanta parte del budget usa la proposta, in percentuale intera.
 *
 * `total` è il totale **già arrotondato e già mostrato** (`roundProposalCosts`),
 * mai il grezzo del modello: una percentuale calcolata su una cifra diversa da
 * quella scritta accanto ricadrebbe nello stesso difetto che l'arrotondamento
 * per voci esiste per evitare.
 *
 * Restituisce `null` quando il budget non è una cifra su cui si possa fare una
 * proporzione (zero, negativo, NaN): la barra allora non si disegna affatto,
 * invece di mostrare un NaN o una percentuale inventata. Il tetto a 100 è
 * necessario perché una proposta al limite del budget arrotonda a 101 e il
 * riempimento sforerebbe il binario.
 */
export function budgetUsagePercent(total: number, budget: number): number | null {
  if (!Number.isFinite(budget) || budget <= 0) return null;
  return Math.min(100, Math.round((total / budget) * 100));
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
  const remaining = budget - costs.total;
  const roundedRemaining = remaining > 0 ? roundToNearestFifty(remaining) : 0;
  const travelPerPerson = derivePerPerson(costs.travelTotal, travelerCount);
  const perPerson = travelerCount > 1 ? derivePerPerson(costs.total, travelerCount) : null;
  const usagePercent = budgetUsagePercent(costs.total, budget);
  const realPriceSearchUrl = departureDate
    ? buildRealPriceSearchUrl(departureCity, proposal.destination, departureDate, proposal.country)
    : null;

  return (
    <Card className="flex h-full flex-col border-border shadow-none">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div>
          {/* Nome e prezzo sulla stessa riga: sono le due cose che si
              confrontano fra sei schede, e finora il totale era sepolto in
              fondo alla tabella dei costi. */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-[725] tracking-[-0.01em] text-primary uppercase">
              {proposal.destination}
            </h2>
            <div className="shrink-0 text-right">
              {/* formatApprox dà solo cifre e simboli ("~1.250 €"): nessuna
                  lettera da tenere in Fraunces, la classe va sull'elemento. */}
              <p className="display-numerals text-xl font-[725] text-primary">
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

        {/* La barra è Bosco per tutte le proposte, senza varianti di colore:
            evidenziare chi sfiora il tetto sembrerebbe premiarla, e non abbiamo
            nessuna ragione per dire che spendere tutto il budget sia meglio. Il
            confronto lo fa la lunghezza, e "ti restano" dice già il resto. */}
        {usagePercent !== null && (
          <div>
            <div className="flex items-center gap-3">
              {/* border-border, non border-input: quello è il bordo dei
                  controlli e farebbe sembrare toccabile una pastiglia che non
                  lo è. */}
              <span className="shrink-0 rounded-full border border-border bg-accent px-2.5 py-0.5 text-xs font-medium text-primary">
                {usagePercent}% del budget
              </span>
              {/* Decorativa: la didascalia qui sotto dice già in testo tutto
                  quello che la barra mostra (quanto si spende, su quanto, e
                  quanto resta), e la percentuale è scritta nella pastiglia
                  accanto. Un role="progressbar" con nome e valori ripeterebbe
                  quelle stesse cifre una seconda volta a chi usa uno screen
                  reader, moltiplicate per sei schede. */}
              <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
              <span>
                {formatApprox(costs.total)} su {euro.format(budget)}
              </span>
              {roundedRemaining > 0 && <span>ti restano {formatApprox(roundedRemaining)}</span>}
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">{proposal.whyItFits}</p>

        <ul className="space-y-1.5 text-sm text-primary">
          {proposal.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-voltage" />
              {highlight}
            </li>
          ))}
        </ul>

        {/* Le tre voci su una riga sola: restano leggibili e smettono di essere
            protagoniste, ora che il totale sta in cima. Nessuna informazione
            persa rispetto alla tabella di prima, compreso il "a persona" del
            viaggio A/R. */}
        <p className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">
          Viaggio A/R {formatApprox(costs.travelTotal)} ({formatApprox(travelPerPerson)} a persona) ·
          Alloggio {formatApprox(costs.lodgingTotal)} · In loco {formatApprox(costs.onSiteTotal)}
        </p>

        {/* La liberatoria sulle stime è salita una volta sola sopra la griglia
            (discover-results.tsx): qui si ripeteva fino a sei volte sullo stesso
            schermo. Questo link invece resta, perché è specifico della meta. */}
        {realPriceSearchUrl && (
          <p className="text-sm text-muted-foreground">
            <a
              href={realPriceSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-primary"
            >
              Verifica i prezzi reali
            </a>
          </p>
        )}

        <Button asChild variant="outline" className="w-full gap-2 border-primary shadow-none">
          <Link href={href}>
            Crea l&apos;itinerario
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
