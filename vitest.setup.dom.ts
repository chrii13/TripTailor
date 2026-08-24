import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `globals: false`: l'auto-cleanup di testing-library non si aggancia da solo,
// va richiamato qui o il DOM del test precedente resta montato e i getBy*
// trovano due volte lo stesso elemento.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom non implementa matchMedia, che lib/use-media-query.ts chiama al primo
// render. Restituiamo sempre `false` (nessuna media query soddisfatta): è il
// valore che l'hook usa già lato server, quindi i componenti partono dal loro
// layout "stretto" — un mese solo nel calendario, che è anche il caso più
// semplice da pilotare in un test.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// I componenti Radix (Select, Popover) usano le Pointer Events API e
// ResizeObserver, che jsdom non ha: senza queste tre righe aprire una Select in
// un test lancia "target.hasPointerCapture is not a function".
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// Niente polyfill per DOMRect: jsdom 29 ce l'ha nativo (verificato dentro e
// fuori vitest). Un sostituto scritto a mano rischierebbe solo di mentire sulle
// misure derivate (top/right/bottom/left).
