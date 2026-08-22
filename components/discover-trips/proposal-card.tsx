import Link from "next/link";
import { ArrowRight, Bed, CalendarDays, MapPin, Moon, Route, Wallet } from "lucide-react";

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
  const perPerson = travelerCount > 1 ? roundToNearestFifty(costs.total / travelerCount) : null;
  const realPriceSearchUrl = departureDate
    ? buildRealPriceSearchUrl(departureCity, proposal.destination, departureDate, proposal.country)
    : null;

  return (
    <Card className="flex h-full flex-col border-border shadow-none">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div>
          <h2 className="font-display text-xl font-[725] tracking-[-0.01em] text-primary uppercase">
            {proposal.destination}
          </h2>
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

        <dl className="mt-auto space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Route className="size-4" />
              Viaggio A/R ({formatApprox(costs.travelPerPerson)} a persona)
            </dt>
            <dd className="font-medium text-primary">{formatApprox(costs.travelTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Bed className="size-4" />
              Alloggio
            </dt>
            <dd className="font-medium text-primary">{formatApprox(costs.lodgingTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-4" />
              Spese in loco
            </dt>
            <dd className="font-medium text-primary">{formatApprox(costs.onSiteTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="font-semibold text-primary">Totale</dt>
            <dd className="font-display text-lg font-[725] text-primary">
              {formatApprox(costs.total)}
            </dd>
          </div>
          {perPerson !== null && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <dt>Per persona</dt>
              <dd>{formatApprox(perPerson)}</dd>
            </div>
          )}
          {roundedRemaining > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <dt>Ti restano</dt>
              <dd>{formatApprox(roundedRemaining)}</dd>
            </div>
          )}
        </dl>

        <p className="text-sm text-muted-foreground">
          Stime indicative generate dall&apos;AI, non prezzi prenotabili.
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
        </p>

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
