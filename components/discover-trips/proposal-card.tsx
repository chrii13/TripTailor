import Link from "next/link";
import { ArrowRight, Bed, MapPin, Plane, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TripProposal } from "@/lib/discover-trips-schema";

interface ProposalCardProps {
  proposal: TripProposal;
  href: string;
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function ProposalCard({ proposal, href }: ProposalCardProps) {
  const { costs } = proposal;

  return (
    <Card className="flex h-full flex-col border-border shadow-none">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div>
          <h3 className="font-display text-xl font-[725] tracking-[-0.01em] text-primary uppercase">
            {proposal.destination}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {proposal.country}
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
              <Plane className="size-4" />
              Viaggio A/R ({euro.format(costs.travelPerPerson)} a persona)
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.travelTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Bed className="size-4" />
              Alloggio
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.lodgingTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="size-4" />
              Spese in loco
            </dt>
            <dd className="font-medium text-primary">{euro.format(costs.onSiteTotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="font-semibold text-primary">Totale</dt>
            <dd className="font-display text-lg font-[725] text-primary">
              {euro.format(costs.total)}
            </dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          Stime indicative generate dall&apos;AI, non prezzi prenotabili.
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
