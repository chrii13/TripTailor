import countries from "world-countries";
import { getCountry } from "countries-and-timezones";

export interface CountryInfo {
  currency: { code: string; symbol: string; name: string };
  languages: string[];
  timezones: string[];
}

function formatUtcOffset(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const part = formatter.formatToParts(new Date()).find((p) => p.type === "timeZoneName");
  return part ? part.value.replace("GMT", "UTC") : timeZone;
}

export function getCountryInfo(countryCode: string): CountryInfo | null {
  const code = countryCode.toUpperCase();
  const country = countries.find((c) => c.cca2 === code);

  if (!country) {
    return null;
  }

  const currencyEntries = Object.entries(country.currencies ?? {});
  if (currencyEntries.length === 0) {
    return null;
  }
  const [currencyCode, currencyData] = currencyEntries[0];
  const currencyNames = new Intl.DisplayNames(["it"], { type: "currency", fallback: "none" });

  const languageCodes = Object.keys(country.languages ?? {});
  const languageNames = new Intl.DisplayNames(["it"], { type: "language", fallback: "none" });
  const languages = languageCodes.map(
    (langCode) => languageNames.of(langCode) ?? country.languages![langCode]
  );

  const timezoneInfo = getCountry(code);
  const timezones = Array.from(new Set((timezoneInfo?.timezones ?? []).map(formatUtcOffset)));

  return {
    currency: {
      code: currencyCode,
      symbol: currencyData.symbol,
      name: currencyNames.of(currencyCode) ?? currencyData.name,
    },
    languages,
    timezones,
  };
}
