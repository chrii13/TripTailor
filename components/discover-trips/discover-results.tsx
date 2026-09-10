"use client";

import { Fragment, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { buildCreaHref } from "@/lib/crea-query-params";
import { formatSearchPeriod, getSearchNights } from "@/lib/discover-trips-recap";
import { resolveProposalDates } from "@/lib/discover-trips-proposal-dates";
import type { TripProposal } from "@/lib/discover-trips-schema";
import { roundProposalCosts } from "@/lib/round-proposal-costs";
import type { Participant } from "@/lib/schema";
import { budgetUsagePercent, ProposalCard } from "./proposal-card";

// Sotto le tre proposte la striscia non serve: due schede si confrontano già
// guardandole, e un blocco in più costerebbe solo altezza in cima alla pagina.
const MIN_PROPOSTE_CONFRONTO = 3;

interface RigaConfronto {
  destination: string;
  percent: number;
}

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
  /** true quando la ricerca ripresa da sessionStorage ha date ormai passate. */
  datesExpired?: boolean;
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
  datesExpired = false,
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

  // Stesse cifre della scheda, per costruzione: si passa dal totale già
  // arrotondato di `roundProposalCosts` e dalla stessa `budgetUsagePercent`.
  // Ricalcolarla qui con una formula propria farebbe dire alla striscia e alla
  // scheda della stessa proposta due percentuali diverse.
  // Il filtro tipizzato non è cerimonia: senza, `percent` resterebbe
  // `number | null` dentro la resa — `every()` non restringe un array — e un
  // domani `width: "null%"` con a fianco il testo "null%" passerebbe `tsc` in
  // silenzio. Filtrando qui, la resa lavora su numeri e basta.
  const righeConfronto: RigaConfronto[] = proposals
    .map((proposal) => ({
      destination: proposal.destination,
      percent: budgetUsagePercent(roundProposalCosts(proposal.costs).total, budget),
    }))
    .filter((riga): riga is RigaConfronto => riga.percent !== null);
  // `percent` è null solo quando il budget non regge una proporzione, cioè per
  // tutte le righe insieme: in quel caso non c'è nessun confronto da mostrare,
  // come già per la barra della scheda. Il confronto con `proposals.length`
  // conserva quel "o tutte o nessuna": una striscia parziale mentirebbe, perché
  // mancherebbero proprio le mete che non si possono confrontare.
  const mostraConfronto =
    righeConfronto.length === proposals.length &&
    righeConfronto.length >= MIN_PROPOSTE_CONFRONTO;

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

      {/* Sta subito sotto la striscia che mostra proprio quel periodo, così si
          legge accanto a ciò che commenta. Testo statico e senza role: compare
          già al primo render dei risultati ripresi, quindi una regione live non
          annuncerebbe comunque nulla, e niente qui deve prendersi il focus. */}
      {datesExpired && (
        <p className="rounded-md border border-voltage bg-voltage/15 px-4 py-3 text-sm text-foreground">
          Le date di questa ricerca sono ormai passate. Le proposte qui sotto restano quelle di
          allora: modifica la ricerca per averne di aggiornate.
        </p>
      )}

      {proposals.length === 0 ? (
        <p className="text-muted-foreground">
          Con questo budget non troviamo proposte per queste date. Prova ad alzare il budget, ad
          accorciare il viaggio o a spostare il periodo.
        </p>
      ) : (
        <>
          {/* Una volta sola per l'intera griglia: dentro la scheda si ripeteva
              fino a sei volte sullo stesso schermo. Vale per tutte le cifre
              qui sotto, quindi sta prima che si comincino a leggere. */}
          <p className="text-sm text-muted-foreground">
            Stime indicative generate dall&apos;AI, non prezzi prenotabili.
          </p>

          {/* Dopo la liberatoria, non prima: le percentuali qui sotto nascono
              dalle stesse stime, quindi vanno lette quando è già detto che
              stime sono. Sopra la griglia perché il confronto fra tutte deve
              arrivare prima delle schede, che da telefono se ne mostrano 1,66
              per schermata. */}
          {mostraConfronto && (
            <section
              aria-labelledby="confronto-budget"
              className="rounded-lg border border-border p-4"
            >
              <h2
                id="confronto-budget"
                className="font-display text-base font-[725] tracking-[-0.01em] text-primary uppercase"
              >
                Il budget a confronto
              </h2>
              {/* Una griglia sola per tutte le righe, con le celle come figli
                  diretti: è l'unico modo perché le barre partano dalla stessa
                  ascissa e abbiano il binario largo uguale: sei flexbox
                  indipendenti darebbero sei binari di lunghezza diversa e il
                  confronto sparirebbe. Nessun separatore fra le righe: le
                  proposte arrivano ordinate per costo crescente, quindi i
                  riempimenti formano quasi sempre una scala che sale, e un
                  filetto per riga la spezzerebbe in sei frammenti.

                  «Quasi sempre» e non «sempre», ed e' voluto: verify-proposal-budget
                  ordina sul totale **grezzo**, mentre qui si disegna quello
                  **arrotondato**, quindi due proposte vicine possono invertirsi
                  (1000 grezzo che arrotonda a 1050, prima di 1010 che arrotonda a
                  1000). Un gradino all'indietro ogni tanto non rompe niente e non
                  vale un riordino: riordinare qui farebbe divergere striscia e
                  griglia, che devono corrispondere. */}
              <div className="mt-3 grid grid-cols-[minmax(0,auto)_minmax(2rem,1fr)_auto] items-center gap-x-3 gap-y-2">
                {righeConfronto.map((riga, index) => (
                  <Fragment key={`${riga.destination}-${index}`}>
                    <span className="text-sm text-primary">{riga.destination}</span>
                    {/* Decorativa, come la barra della scheda: la percentuale è
                        scritta in testo qui accanto, e un role="progressbar"
                        ripeterebbe quella stessa cifra una seconda volta a chi
                        usa uno screen reader, moltiplicata per sei righe. */}
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-accent">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${riga.percent}%` }}
                      />
                    </span>
                    {/* Allineate a destra: in una colonna di numeri che si
                        scorre, "8%" e "83%" con il simbolo disallineato si
                        vedono. tabular-nums da solo non basta, perche' la cella
                        e' larga quanto "100%" e il testo resterebbe a sinistra. */}
                    <span className="justify-self-end text-sm text-muted-foreground tabular-nums">
                      {riga.percent}%
                    </span>
                  </Fragment>
                ))}
              </div>
            </section>
          )}

          {/* Il numero di proposte mostrate non è quello richiesto: i filtri lato
           server ne scartano, quindi l'ultima riga può restare con una sola card.
           In quel caso la card occupa entrambe le colonne ma tiene la larghezza di
           una (metà della riga meno metà del gap di 1rem) e si centra, invece di
           appoggiarsi a sinistra con il vuoto accanto. Sotto `sm` la griglia è a
           una colonna e la regola non si applica. */}
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
        </>
      )}
    </div>
  );
}
