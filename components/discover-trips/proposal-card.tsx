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
    // `rounded-lg` (10px) e non il `rounded-xl` (14px) con cui nasce la Card di
    // shadcn: è la regola di CLAUDE.md, disattesa qui fino a oggi. Non si vedeva
    // finché la card era bianca su Nebbia con un bordo da 1px; ora la fascia
    // Bosco piena disegna i due angoli in alto, subito sotto un avviso a 8px, e
    // l'incoerenza salta all'occhio.
    // Nota: le altre quattro Card del progetto sono ancora a 14px — vanno
    // allineate a parte, non di nascosto dentro questo lavoro.
    <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-lg border-border p-0 shadow-none">
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

      {/* `gap-5` e non `gap-4`. Il confronto che conta e' fra **spazio bianco**,
          non fra un gap e una line-height: la line-height include le mezze
          interlinee dentro il box, quindi paragonarla a un gap e' mele con pere.
          A conti fatti: fra due righe del paragrafo ci sono ~9px di bianco
          (22,75 meno i 14 del carattere), mentre fra paragrafo ed elenco ce ne
          sono ~29 (i 20 del gap piu' le mezze interlinee dei due blocchi). Con
          `gap-4` erano ~25 contro 6, un rapporto che non bastava a staccarli, e
          motivo ed elenco si leggevano come una cosa sola.
          La regola vale fra blocchi, non dentro: l'elenco qui sotto sta a 6px
          per voce ed e' giusto cosi', perche' quelle voci **sono** un blocco. */}
      <div className="flex flex-1 flex-col gap-5 px-6 pt-5 pb-5">
        {/* `leading-relaxed`: il motivo e' l'unico paragrafo vero della scheda e
            su una colonna stretta arriva a quattro righe. A 14px l'interlinea di
            default valeva 20px, cioe' 1,43 — stretta da leggere. */}
        <p className="text-sm leading-relaxed text-muted-foreground">{proposal.whyItFits}</p>

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
      {/* `gap-4` fra tre zone, non `space-y-3` fra cinque elementi. Prima tutto
          era distanziato di 12px uguali — il prezzo, la riga del budget, i
          costi, il link e il bottone — cioe' cose con ruoli diversissimi
          separate allo stesso modo: le righine grigie si fondevano in un blocco
          unico e il link finiva lontano dai costi quanto il bottone era lontano
          da lui. Ora: la cifra, il gruppo dei conti (che sta stretto perche'
          parla di una cosa sola), l'azione. */}
      <div className="mt-auto flex flex-col gap-4 border-t border-border bg-accent px-6 pt-4 pb-6">
        {/* Tutto su un bordo solo, a sinistra. Prima l'etichetta stava spinta a
            sinistra e la cifra a destra, con un vuoto in mezzo, e sotto il "a
            persona" tornava a destra mentre le righe dei conti erano a sinistra:
            due bordi di allineamento che si contendevano lo stesso blocco, e
            niente che lo tenesse insieme — "incastrate male", parole
            dell'utente. Un blocco, un bordo.

            L'etichetta resta **prima** del totale nell'ordine di lettura: la
            tilde da sola non basta, quasi nessuno la decodifica come "stima", e
            chi salta al numero deve incontrare la qualifica per prima.

            `display-numerals` e non `font-display`: l'utente ha chiesto il
            2026-08-23 che le cifre dentro i titoli display restino nel
            carattere di testo, perché il "4" di Fraunces non piace. La cifra è
            "display" per peso (725) e corpo, non per famiglia.

            "Totale" è un `sr-only`: a schermo lo dice l'etichetta sopra, ma chi
            ascolta sentirebbe solo "circa mille euro" senza sapere di cosa. */}
        <div>
          <p className="font-display text-[10px] font-[725] tracking-[0.16em] text-muted-foreground uppercase">
            Stima AI
          </p>
          <p className="display-numerals mt-1 text-2xl font-[725] text-primary">
            <span className="sr-only">Totale </span>
            {formatApprox(costs.total)}
            {perPerson !== null && (
              <span className="ml-2 align-baseline text-xs font-normal text-muted-foreground">
                {formatApprox(perPerson)} a persona
              </span>
            )}
          </p>
        </div>

        {/* I conti e il link stanno in un gruppo loro, distanziati di 6px: sono
            tutti la stessa cosa — quanto costa, come si scompone, dove andare a
            controllarlo — e devono leggersi come un blocco, non come tre righe
            indipendenti che galleggiano.

            Questo gruppo **non è mai vuoto**, e non per caso: delle tre righe,
            quella dei costi non ha guardie. Le altre due sì (budget e link), e
            se un domani si condizionasse anche la terza il gruppo potrebbe
            restare senza figli, lasciando 16px di vuoto fra la cifra e il
            bottone senza che niente lo segnali. */}
        <div className="space-y-1.5">
          {/* Senza questa guardia, con un budget a zero o non numerico la riga
              scriverebbe "su NaN euro". Il predicato dice esattamente questo e
              niente di piu': vedi budgetIsComparable.

              `gap-x-1.5` e non `gap-x-2`: il «·» qui e' separato da un gap di
              flex, mentre nella riga dei costi qui sotto e' un carattere con
              spazi normali. A 8px per lato i due separatori, impilati uno
              sull'altro, si spaziavano visibilmente in modo diverso. */}
          {budgetConfrontabile && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
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
              "a persona" del viaggio A/R.

              Ogni voce e' un `inline-block` che non si spezza: in colonna
              stretta il testo andava a capo **in mezzo a una voce** — "Alloggio"
              su una riga e "~400 €" su quella dopo, separato dal proprio prezzo.
              Va a capo fra una voce e l'altra, mai dentro. Il flex con `gap-x`
              fa anche da separatore: i "·" scritti a mano sparivano a fine riga
              lasciando uno spazio senza motivo.

              Il "a persona" del viaggio solo con piu' di un viaggiatore: da solo
              ripeterebbe la stessa cifra a due parole di distanza ("~85 € (~85 €
              a persona)"), che e' rumore e fa dubitare di aver letto male. */}
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              Viaggio A/R {formatApprox(costs.travelTotal)}
              {travelerCount > 1 && ` (${formatApprox(travelPerPerson)} a persona)`}
            </span>
            {/* Il «·» sta **dentro** la voce che segue, non fra le due: come
                figlio a sé del flex finirebbe a volte a fine riga, orfano. Cosi'
                resta attaccato alla sua voce e, quando si va a capo, apre la
                riga nuova — che e' come si legge un elenco in linea. */}
            <span className="whitespace-nowrap">
              <span aria-hidden>· </span>Alloggio {formatApprox(costs.lodgingTotal)}
            </span>
            <span className="whitespace-nowrap">
              <span aria-hidden>· </span>In loco {formatApprox(costs.onSiteTotal)}
            </span>
          </p>

          {/* Il link resta nella scheda perché è l'unica cosa dell'avvertenza
              che è specifica della meta: porta a una ricerca costruita su questa
              destinazione e questa data. Il testo lungo, che era identico in
              tutte e sei le schede, è salito sopra la griglia. */}
          {realPriceSearchUrl && (
            <p className="text-xs text-muted-foreground">
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
        </div>

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
