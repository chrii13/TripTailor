import { Button } from "@/components/ui/button";
import { buildCreaHref } from "@/lib/crea-query-params";
import { formatSearchPeriod, getSearchNights } from "@/lib/discover-trips-recap";
import { resolveProposalDates } from "@/lib/discover-trips-proposal-dates";
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
  dateMode: "esatte" | "flessibili";
  dateRange: { from?: Date; to?: Date };
  flexiblePeriod: { month?: string; nights?: number };
  participants: Participant[];
  budget: number;
  departureCity: string;
  onEdit: () => void;
}

export function DiscoverResults({
  proposals,
  dateMode,
  dateRange,
  flexiblePeriod,
  participants,
  budget,
  departureCity,
  onEdit,
}: DiscoverResultsProps) {
  const nights = getSearchNights({ dateMode, dateRange, flexiblePeriod });
  const periodLabel = formatSearchPeriod({ dateMode, dateRange, flexiblePeriod });
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
        Da {departureCity} · {periodLabel} · {travelerCount}{" "}
        {travelerCount === 1 ? "viaggiatore" : "viaggiatori"} · budget {euro.format(budget)}
      </p>

      {proposals.length === 0 ? (
        <p className="text-muted-foreground">
          Con questo budget non troviamo proposte per queste date. Prova ad alzare il budget, ad
          accorciare il viaggio o a spostare il periodo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {proposals.map((proposal, index) => {
            const proposalDates = resolveProposalDates(proposal, dateMode, dateRange);
            return (
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
                  from: proposalDates.from,
                  to: proposalDates.to,
                  budget: proposal.costs.onSiteTotal,
                  participants,
                })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
