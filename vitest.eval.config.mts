import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Live checks against the real Gemini API. They skip themselves without a key. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["evals/**/*.eval.ts"],
    testTimeout: 120_000,
  },
});
