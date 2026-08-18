import type { ItineraryPdfInput } from "./itinerary-pdf";
import type { Activity } from "./itinerary-schema";

// Testi di lunghezza variabile: servono a far emergere i problemi di
// impaginazione che con paragrafi tutti uguali resterebbero nascosti.
const ABOUT = [
  "Fortezza moresca che domina il centro storico dall'alto della collina, con undici torri e un giro di mura percorribile.",
  "La chiesa più antica della città: fondata nel 1147, mescola romanico, gotico e barocco dopo secoli di terremoti e restauri.",
  "Museo dedicato alla musica tradizionale portoghese, con ascolti guidati e strumenti originali.",
  "Monastero manuelino patrimonio UNESCO, costruito con l'oro delle spezie e affacciato sul lungofiume di Belém.",
  "Torre cinquecentesca sull'estuario del Tago, un tempo posto di guardia e prigione, oggi il simbolo della città.",
  "Statua monumentale sulla riva opposta del fiume: si sale in ascensore fino alla piattaforma panoramica.",
  "Collezione che spazia dall'arte egizia agli impressionisti, immersa in un parco molto amato dai lisboeti.",
  "Ascensore in ferro battuto di fine Ottocento che collega la Baixa al Chiado, con terrazza in cima.",
  "Mercato coperto dove decine di banchi propongono la cucina di chef locali sotto un'unica tettoia.",
  "Quartiere di vicoli e scalinate, il più antico della città, sopravvissuto al terremoto del 1755.",
];
const GETTING = [
  "Quartiere di Alfama: a piedi in salita dalla Baixa, oppure con il tram 28, fermata Miradouro de Santa Luzia.",
  "A Belém, tram 15E da Praça da Figueira, circa 25 minuti; la fermata è davanti all'ingresso.",
  "Metropolitana linea blu fino a São Sebastião, poi due minuti a piedi attraverso il giardino.",
  "Traghetto da Cais do Sodré fino a Cacilhas, poi autobus 101: in tutto una quarantina di minuti.",
];
const TIPS = [
  "Arriva all'apertura per evitare la coda e goderti la frescura della mattina.",
  "Il biglietto combinato con il monastero fa risparmiare qualche euro: si compra solo alla biglietteria.",
  "Porta scarpe comode: la pavimentazione a mosaico è bellissima ma scivolosa quando piove.",
  "Ultimo ingresso mezz'ora prima della chiusura, e nel weekend l'attesa può superare l'ora.",
];

let seq = 0;

function activity(
  title: string,
  suggestedTime: string,
  estimatedCost: string,
  extra: Partial<Activity> = {}
): Activity {
  const i = seq++;
  return {
    title,
    suggestedTime,
    estimatedCost,
    description: `Descrizione breve di ${title}.`,
    details: {
      about: ABOUT[i % ABOUT.length],
      gettingThere: GETTING[i % GETTING.length],
      tips: TIPS[i % TIPS.length],
    },
    ...extra,
  };
}

export const PDF_FIXTURE: ItineraryPdfInput = {
  tripData: {
    destination: "Lisbona, Portogallo",
    dateRange: { from: new Date("2026-09-12"), to: new Date("2026-09-14") },
    participants: [
      { type: "adulto", age: 31 },
      { type: "bambino", age: 8 },
    ],
    budget: 1000,
    styleNotes: "Ritmo tranquillo, cucina locale",
    mustSee: "Cristo Rei di Almada",
    arrivalTime: "",
    departureTime: "",
  },
  itinerary: {
    days: [
      {
        date: "2026-09-12",
        mattina: [
          activity("Castello di San Giorgio", "09:30–11:30", "~15€", { openingHours: "09:00–21:00" }),
          activity("Cattedrale di Lisbona", "11:45–12:30", "Gratuito"),
        ],
        pomeriggio: [activity("Museo del Fado", "14:30–16:30", "~5€")],
        sera: [activity("Cena tipica in Alfama", "20:00–22:00", "~30€")],
      },
      {
        date: "2026-09-13",
        mattina: [activity("Monastero dei Jerónimos", "09:30–12:00", "~12€")],
        pomeriggio: [
          activity("Torre di Belém", "14:00–15:30", "~8€"),
          activity("Cristo Rei di Almada", "16:30–18:30", "~8€"),
        ],
        sera: [activity("Cena al Time Out Market", "20:00–22:00", "~25€")],
      },
      {
        date: "2026-09-14",
        mattina: [activity("Museo Calouste Gulbenkian", "10:00–12:30", "~10€")],
        pomeriggio: [activity("Elevador de Santa Justa", "14:30–15:30", "~6€")],
        sera: [activity("Cena d'addio a Cais do Sodré", "20:00–22:30", "~40€")],
      },
    ],
  },
  weather: [
    { date: "2026-09-12", tempMaxAvg: 26, tempMinAvg: 18, precipitationChance: 40 },
    { date: "2026-09-13", tempMaxAvg: 27, tempMinAvg: 18, precipitationChance: 40 },
    // il terzo giorno manca di proposito: copre il caso "media non disponibile"
  ],
  countryInfo: {
    name: "Portogallo",
    code: "PT",
    currency: { code: "EUR", symbol: "€", name: "euro" },
    languages: ["portoghese"],
    timezones: ["UTC", "UTC+1"],
  },
};
