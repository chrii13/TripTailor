import { differenceInCalendarDays, format } from "date-fns";

import { Button } from "@/components/ui/button";
import { buildCreaHref } from "@/lib/crea-query-params";
import type { TripProposal } from "@/lib/discover-trips-schema";
import type { Participant } from "@/lib/schema";
import { ProposalCard } from "./proposal-card";

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface DiscoverResultsProps {
  proposals: TripProposal[];
  dateRange: { from?: Date; to?: Date };
  participants: Participant[];
  budget: number;
  departureCity: string;
  onEdit: () => void;
}

export function DiscoverResults({
  proposals,
  dateRange,
  participants,
  budget,
  departureCity,
  onEdit,
}: DiscoverResultsProps) {
  const nights =
    dateRange.from && dateRange.to
      ? Math.max(differenceInCalendarDays(dateRange.to, dateRange.from), 0)
      : 0;
  const travelerCount = participants.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-[725] tracking-[-0.01em] text-primary uppercase">
          {proposals.length > 0 ? "Dove puoi andare" : "Nessuna proposta"}
        </h2>
        <Button variant="outline" onClick={onEdit} className="border-primary shadow-none">
          Modifica la ricerca
        </Button>
      </div>

      <p className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
        Da {departureCity} · {dateRange.from && dateRange.to
          ? nights === 0
            ? `${format(dateRange.from, "dd MMM")} (in giornata)`
            : `${format(dateRange.from, "dd MMM")} - ${format(dateRange.to, "dd MMM")}`
          : "date da confermare"}{" "}
        · {travelerCount} {travelerCount === 1 ? "viaggiatore" : "viaggiatori"} · budget{" "}
        {euro.format(budget)}
      </p>

      {proposals.length === 0 ? (
        <p className="text-muted-foreground">
          Con questo budget non troviamo proposte per queste date. Prova ad alzare il budget, ad
          accorciare il viaggio o a spostare il periodo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {proposals.map((proposal, index) => (
            <ProposalCard
              key={`${proposal.destination}-${proposal.country}-${index}`}
              proposal={proposal}
              budget={budget}
              travelerCount={travelerCount}
              nights={nights}
              departureCity={departureCity}
              departureDate={dateRange.from}
              href={buildCreaHref({
                destination: `${proposal.destination}, ${proposal.country}`,
                from: dateRange.from,
                to: dateRange.to,
                budget: proposal.costs.onSiteTotal,
                participants,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
