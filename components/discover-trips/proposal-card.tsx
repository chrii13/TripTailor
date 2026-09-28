import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const nightsLabel =
    nights === 0 ? "in giornata" : `${nights} ${nights === 1 ? "notte" : "notti"}`;

  return (
    // `p-0 gap-0` perché la card non ha più un solo contenuto con padding
    // proprio ma tre fasce a filo dei bordi: la spaziatura la mette ciascuna.
    // `overflow-hidden` è quel che tiene la testata dentro gli angoli tondi.
    <Card className="flex h-full flex-col gap-0 overflow-hidden border-border p-0 shadow-none">
      {/* Testata invertita. Le tre righe di icone di prima (paese, notti,
          finestra consigliata) si fondono qui: il paese fa da occhiello, notti
          e date stanno su una riga sola. Le icone non servono più — con tre
          etichette in fila su un fondo pieno facevano rumore, e ciascuna
          ripeteva in figura una parola già scritta accanto.

          Il totale non è più in questa fascia: in testata comanda il nome, che
          è quel che si confronta fra sei schede, e la cifra è scesa nel piede
          insieme a tutti gli altri conti. */}
      <div className="bg-primary px-6 pt-5 pb-4 text-primary-foreground">
        {/* `text-primary-foreground/60` è la convenzione già in uso nella
            testata invertita di `itinerary-form/itinerary-result.tsx`. Misurato
            su Bosco (#1a4d33): bianco pieno 9,75:1, al 60% 4,65:1 — sopra la
            soglia 4,5:1 di WCAG 1.4.3 anche per il testo piccolo, quindi
            l'opacità non va abbassata oltre. */}
        <p className="text-xs font-semibold tracking-[0.18em] text-primary-foreground/60 uppercase">
          {proposal.country}
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-tight font-[725] tracking-[-0.01em] uppercase">
          {proposal.destination}
        </h2>
        <p className="mt-2 text-sm text-primary-foreground/60">
          {nightsLabel}
          {suggestedWindow && ` · Consigliato ${suggestedWindow}`}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-5">
        <p className="text-sm text-muted-foreground">{proposal.whyItFits}</p>

        <ul className="space-y-1.5 text-sm text-primary">
          {proposal.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-voltage" />
              {highlight}
            </li>
          ))}
        </ul>
      </div>

      {/* Fascia Nebbia che chiude la card, come la CTA di /crea e /scopri:
          tutto quel che riguarda le cifre — quanto costa, quanto costa sul
          budget, come si scompone, quanto vale la stima — sta insieme sotto il
          racconto della meta. */}
      {/* bg-accent e non bg-secondary: su /scopri il fondo della pagina E' gia'
          Nebbia, misurato rgb(236,239,233) identico, quindi un piede Nebbia
          faceva sparire meta' scheda nella pagina, tenuta solo da un bordo di
          un pixel. Su /crea la stessa fascia funziona perche' li' il fondo e'
          diverso: non copiare quella scelta qui senza guardare. */}
      <div className="mt-auto space-y-3 border-t border-border bg-accent px-6 pt-4 pb-6">
        {/* Etichetta a sinistra e cifra a destra sulla stessa riga. L'etichetta
            resta **prima** del totale nell'ordine di lettura: la tilde da sola
            non basta, quasi nessuno la decodifica come "stima", e chi salta
            direttamente al numero deve incontrare la qualifica per prima.
            L'avvertenza per intero sta ora sopra la griglia, una volta sola.

            `display-numerals` e non `font-display`: l'utente ha chiesto il
            2026-08-23 che le cifre dentro i titoli display restino nel
            carattere di testo, perché il "4" di Fraunces non piace. La cifra è
            "display" per peso (725) e corpo, non per famiglia.

            "Totale" è un `sr-only`: a schermo lo dice la posizione accanto
            all'etichetta, ma chi ascolta sentirebbe solo "circa mille euro"
            senza sapere di cosa. */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[10px] font-[725] tracking-[0.16em] text-muted-foreground uppercase">
            Stima AI
          </p>
          <div className="text-right">
            <p className="display-numerals text-xl font-[725] text-primary">
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
            essere protagoniste, ora che il totale ha la sua riga. Nessuna
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

        {/* Il link resta nella scheda perché è l'unica cosa dell'avvertenza che
            è specifica della meta: porta a una ricerca costruita su questa
            destinazione e questa data. Il testo lungo, che era identico in
            tutte e sei le schede, è salito sopra la griglia. */}
        {realPriceSearchUrl && (
          <p className="pt-1 text-xs text-muted-foreground">
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
      </div>
    </Card>
  );
}
