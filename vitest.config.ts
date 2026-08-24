import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

// Escludiamo il worktree di Claude Code in aggiunta (non al posto) delle
// esclusioni di default di vitest (node_modules e affini): test.exclude
// sovrascrive l'array di default se non lo si include esplicitamente.
const exclude = [...configDefaults.exclude, ".claude/**"];

// Due ambienti, tenuti separati perché "node" è sensibilmente più veloce e i
// test di funzione pura non hanno bisogno di un DOM. Il confine è il percorso,
// non un suffisso da ricordare:
//
//   components/**/*.test.tsx  → jsdom  (montano un componente React)
//   tutto il resto            → node   (funzioni pure di lib/, route handler)
//
// Regola pratica: un test che monta un componente vive accanto al componente e
// finisce in .tsx. Nient'altro finisce in jsdom — `lib/itinerary-pdf.test.tsx`
// scrive JSX ma resta un test di funzione pura, e resta in node.
//
// `extends: true` fa ereditare a ogni progetto il `resolve.alias` qui sotto.
const DOM_TESTS = "components/**/*.test.tsx";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts", "**/*.test.tsx"],
          exclude: [...exclude, DOM_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [DOM_TESTS],
          exclude,
          setupFiles: ["./vitest.setup.dom.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
