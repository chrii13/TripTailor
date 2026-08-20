import { useSyncExternalStore } from "react";

/**
 * Riporta se il viewport corrisponde alla media query data, aggiornandosi
 * quando cambia (resize, rotazione, ecc.).
 *
 * SSR-safe: `window` non esiste lato server, quindi `getServerSnapshot`
 * restituisce sempre `false` — usato sia per il render server sia per il
 * primo render client, prima che React idrati e possa leggere lo stato
 * reale del browser tramite `matchMedia`. Il markup del primo render
 * client è quindi identico a quello del server e non scatta alcun
 * mismatch di idratazione. Chi usa questo hook deve trattare `false` come
 * il valore "sicuro" di partenza.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
