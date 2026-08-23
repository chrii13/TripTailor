"use client";

import { useEffect, useRef } from "react";

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
  /** true solo quando i risultati arrivano da una ricerca appena inviata. */
  focusHeading?: boolean;
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
  focusHeading = false,
  onEdit,
}: DiscoverResultsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Il form sparisce e al suo posto compaiono le proposte: senza spostare il focus,
  // chi naviga da tastiera o con screen reader resta su un punto della pagina che
  // non esiste più. È la convenzione dei risultati di ricerca — si porta il focus
  // sull'intestazione (non sul primo risultato) così l'esito si sente per intero.
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  const nights = getSearchNights({ dateMode, dateRange, flexiblePeriod });
  const periodLabel = formatSearchPeriod({ dateMode, dateRange, flexiblePeriod });
  const travelerCount = participants.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-[725] tracking-[-0.01em] text-primary uppercase outline-none"
        >
          {proposals.length > 0 ? "Dove puoi andare" : "Nessuna proposta"}
        </h1>
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
        /* Il numero di proposte mostrate non è quello richiesto: i filtri lato
           server ne scartano, quindi l'ultima riga può restare con una sola card.
           In quel caso la card occupa entrambe le colonne ma tiene la larghezza di
           una (metà della riga meno metà del gap di 1rem) e si centra, invece di
           appoggiarsi a sinistra con il vuoto accanto. Sotto `sm` la griglia è a
           una colonna e la regola non si applica. */
        <div className="grid gap-4 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:w-[calc(50%-0.5rem)] sm:[&>*:last-child:nth-child(odd)]:justify-self-center">
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
                // Le date "vere" della proposta, non solo quelle scelte a mano:
                // in modalità flessibile `dateRange.from` è undefined e il link
                // "Verifica i prezzi reali" sparirebbe proprio dove serve di più.
                departureDate={proposalDates.from}
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
