import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Escludiamo il worktree di Claude Code in aggiunta (non al posto) delle
    // esclusioni di default di vitest (node_modules e affini): test.exclude
    // sovrascrive l'array di default se non lo si include esplicitamente.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
