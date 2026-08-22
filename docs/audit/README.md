# Audit del 21 agosto 2026

165 rilievi da sei revisioni indipendenti del codice, più una batteria di prove eseguite
sul sito in produzione (misure del DOM a 360, 700 e 1440 pixel e chiamate reali alle due
API). Nessuno dei report è stato scritto guardando gli altri: le sovrapposizioni fra loro
sono conferme indipendenti, non copie.

| File | Ambito |
|---|---|
| [A-landing-grafica.md](A-landing-grafica.md) | Landing page: sistema visivo, tipografia, ritmo, responsive, animazioni, copy |
| [B-accessibilita.md](B-accessibilita.md) | WCAG 2.2 AA su tutta l'app, con i rapporti di contrasto calcolati |
| [C-flusso-crea.md](C-flusso-crea.md) | `/crea`: casi limite, validazione, stati di errore |
| [D-flusso-scopri.md](D-flusso-scopri.md) | `/scopri`: aritmetica dei costi, date flessibili, persistenza |
| [E-api-sicurezza.md](E-api-sicurezza.md) | Route API, budget di tempo, prompt injection, qualità dei prompt |
| [F-codice-e-test.md](F-codice-e-test.md) | Copertura, type safety, Next.js, performance, igiene |
| [G-prove-in-produzione.md](G-prove-in-produzione.md) | Ciò che è stato verificato sul sito vero, non dedotto dal codice |

## Già corretto e in produzione (merge `9a64b9d`, 21 agosto 2026)

- **Le date slittavano di un giorno.** Il difetto peggiore: chi chiedeva 10-12 ottobre
  riceveva un itinerario datato 9-11, meteo compreso. Riguardava entrambi i flussi, non
  solo quello segnalato dal report C. La regola che lo previene è ora in `CLAUDE.md`.
- **Il totale mostrato poteva sfondare il budget su `/scopri`** (arrotondamento dopo il filtro).
- **L'export calendario crashava in silenzio** su un trattino diverso da quello atteso.
- **Il meteo storico poteva consumare 82s** contro un `maxDuration` di 60.

## Ancora aperto, in ordine di danno

1. **Nessun rate limiting** sulle tre route pubbliche che chiamano Gemini a pagamento
   (rilievo E-1). Richiede un account Upstash e un tetto di spesa su Google Cloud.
2. **`/crea` e `/scopri` non hanno titoli né landmark** (rilievo B, confermato in G).
3. **Il nastro delle bandiere non ha un comando di pausa** — WCAG 2.2.2, livello A.
4. **404 di fabbrica in inglese, nessun Open Graph, metadata identici sulle tre pagine.**
5. **Date nel passato selezionabili** su entrambi i flussi.
6. **Gerarchia h1/h2 invertita fra 640 e 873px**: il titolo di pagina è il più piccolo.

Le etichette *Confermato in produzione* e *Misurato* nel report G distinguono ciò che è
stato verificato sul sito vero da ciò che emerge dalla sola lettura del codice.
