import { Document, Font, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";

import { PARTICIPANT_TYPE_LABELS, type TripFormValues } from "@/lib/schema";
import type { Activity, ItineraryResponse } from "@/lib/itinerary-schema";
import type { DailyClimateAverage } from "@/lib/climate-forecast";
import type { CountryInfo } from "@/lib/country-info";

const BOSCO = "#1a4d33";
const SOLE = "#f0b429";
const INCHIOSTRO = "#3d423c";
const SLATE = "#666b64";
const NEBBIA = "#ecefe9";
const FILETTO = "#d4dad1";

Font.register({ family: "Fraunces", src: "/fonts/Fraunces-Bold.ttf", fontWeight: 700 });
Font.register({
  family: "Geist",
  fonts: [
    { src: "/fonts/Geist-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Geist-Medium.ttf", fontWeight: 500 },
  ],
});

const SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
] as const;

const s = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 10,
    color: INCHIOSTRO,
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 46,
    lineHeight: 1.5,
  },
  rule: { width: 26, height: 3, backgroundColor: SOLE, marginBottom: 12 },
  wordmark: { fontSize: 8, letterSpacing: 2, color: SLATE, marginBottom: 8 },
  title: { fontFamily: "Fraunces", fontWeight: 700, fontSize: 26, color: BOSCO, lineHeight: 1.1 },

  summary: { backgroundColor: BOSCO, borderRadius: 6, padding: 16, marginTop: 18, flexDirection: "row" },
  summaryCell: { flex: 1, paddingRight: 10 },
  summaryLabel: { fontSize: 7, letterSpacing: 1.4, color: "#a9bdaf", textTransform: "uppercase" },
  summaryValue: { fontSize: 11, fontWeight: 500, color: "#ffffff", marginTop: 4 },

  country: { flexDirection: "row", marginTop: 12, borderWidth: 1, borderColor: FILETTO, borderRadius: 6, padding: 12 },
  countryCell: { flex: 1, paddingRight: 10 },
  countryLabel: { fontSize: 7, letterSpacing: 1.4, color: SLATE, textTransform: "uppercase" },
  countryValue: { fontSize: 10, fontWeight: 500, color: BOSCO, marginTop: 3 },

  dayHeader: {
    marginTop: 22,
    backgroundColor: BOSCO,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayTitle: { fontFamily: "Fraunces", fontWeight: 700, fontSize: 13, color: "#ffffff", textTransform: "uppercase" },
  dayDate: { fontSize: 10, color: "#c3d3c7" },
  climate: {
    backgroundColor: NEBBIA,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 8.5,
    color: SLATE,
  },

  slotLabel: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 5,
  },
  activity: { marginBottom: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: NEBBIA },
  actHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  actTitle: { fontSize: 11, fontWeight: 500, color: BOSCO, flex: 1, paddingRight: 10 },
  actMeta: { fontSize: 9, color: SLATE },
  actTime: { fontSize: 9, fontWeight: 500, color: INCHIOSTRO, marginBottom: 3 },
  actAbout: { fontSize: 9, color: SLATE, marginBottom: 4 },
  detail: { flexDirection: "row", marginTop: 3 },
  detailLabel: { width: 62, fontSize: 8, letterSpacing: 0.8, color: SLATE, textTransform: "uppercase" },
  detailText: { flex: 1, fontSize: 9, color: INCHIOSTRO },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: FILETTO,
    paddingTop: 8,
    fontSize: 8,
    color: SLATE,
  },
});

function formatDateRange(from: Date, to: Date): string {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${format(from, "dd")}–${format(to, "dd/MM/yyyy")}`
    : `${format(from, "dd/MM")}–${format(to, "dd/MM/yyyy")}`;
}

function ActivityBlock({ activity }: { activity: Activity }) {
  return (
    <View style={s.activity} wrap={false}>
      <View style={s.actHead}>
        <Text style={s.actTitle}>{activity.title}</Text>
        <Text style={s.actMeta}>{activity.estimatedCost}</Text>
      </View>
      <Text style={s.actTime}>
        {activity.suggestedTime}
        {activity.openingHours ? `  ·  apertura ${activity.openingHours}` : ""}
      </Text>
      <Text style={s.actAbout}>{activity.details.about}</Text>
      <View style={s.detail}>
        <Text style={s.detailLabel}>Arrivarci</Text>
        <Text style={s.detailText}>{activity.details.gettingThere}</Text>
      </View>
      <View style={s.detail}>
        <Text style={s.detailLabel}>Consigli</Text>
        <Text style={s.detailText}>{activity.details.tips}</Text>
      </View>
    </View>
  );
}

export interface ItineraryPdfInput {
  tripData: TripFormValues;
  itinerary: ItineraryResponse;
  weather: DailyClimateAverage[] | null;
  countryInfo: CountryInfo | null;
}

export function ItineraryDocument({ tripData, itinerary, weather, countryInfo }: ItineraryPdfInput) {
  const travellers = tripData.participants
    .map((p) => `${PARTICIPANT_TYPE_LABELS[p.type]} (${p.age})`)
    .join(", ");

  return (
    <Document
      title={`Itinerario — ${tripData.destination}`}
      author="TripTailor"
      language="it"
    >
      <Page size="A4" style={s.page}>
        <View style={s.rule} />
        <Text style={s.wordmark}>TRIPTAILOR</Text>
        <Text style={s.title}>{tripData.destination}</Text>

        <View style={s.summary}>
          {tripData.dateRange.from && tripData.dateRange.to && (
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Date</Text>
              <Text style={s.summaryValue}>
                {formatDateRange(tripData.dateRange.from, tripData.dateRange.to)}
              </Text>
            </View>
          )}
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>
              {tripData.participants.length > 1 ? "Viaggiatori" : "Viaggiatore"}
            </Text>
            <Text style={s.summaryValue}>{travellers}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Budget</Text>
            <Text style={s.summaryValue}>{tripData.budget}€</Text>
          </View>
        </View>

        {countryInfo && (
          <View style={s.country}>
            <View style={s.countryCell}>
              <Text style={s.countryLabel}>Paese</Text>
              <Text style={s.countryValue}>{countryInfo.name}</Text>
            </View>
            <View style={s.countryCell}>
              <Text style={s.countryLabel}>Valuta</Text>
              <Text style={s.countryValue}>
                {countryInfo.currency.name} ({countryInfo.currency.symbol})
              </Text>
            </View>
            {countryInfo.languages.length > 0 && (
              <View style={s.countryCell}>
                <Text style={s.countryLabel}>
                  {countryInfo.languages.length > 1 ? "Lingue" : "Lingua"}
                </Text>
                <Text style={s.countryValue}>{countryInfo.languages.join(", ")}</Text>
              </View>
            )}
            {countryInfo.timezones.length > 0 && (
              <View style={s.countryCell}>
                <Text style={s.countryLabel}>
                  {countryInfo.timezones.length > 1 ? "Fusi orari" : "Fuso orario"}
                </Text>
                <Text style={s.countryValue}>{countryInfo.timezones.join(", ")}</Text>
              </View>
            )}
          </View>
        )}

        {itinerary.days.map((day, dayIndex) => {
          const parsed = new Date(day.date);
          const dayDate = Number.isNaN(parsed.getTime()) ? day.date : format(parsed, "dd/MM/yyyy");
          const dayWeather = weather?.find((entry) => entry.date === day.date);

          return (
            <View key={dayIndex} break={dayIndex > 0}>
              <View style={s.dayHeader}>
                <Text style={s.dayTitle}>Giorno {dayIndex + 1}</Text>
                <Text style={s.dayDate}>{dayDate}</Text>
              </View>
              <Text style={s.climate}>
                {dayWeather
                  ? `Media degli ultimi 5 anni: ${dayWeather.tempMaxAvg}° / ${dayWeather.tempMinAvg}°, pioggia ${dayWeather.precipitationChance}%`
                  : "Media climatica non disponibile per questa data."}
              </Text>

              {SLOTS.map(({ key, label }) =>
                day[key].length > 0 ? (
                  <View key={key}>
                    <Text style={s.slotLabel}>{label}</Text>
                    {day[key].map((activity, i) => (
                      <ActivityBlock key={i} activity={activity} />
                    ))}
                  </View>
                ) : null
              )}
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text>Itinerario generato da TripTailor</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function buildItineraryPdfBlob(input: ItineraryPdfInput): Promise<Blob> {
  return pdf(<ItineraryDocument {...input} />).toBlob();
}
