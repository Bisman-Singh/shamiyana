import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests run in Node by default; component tests opt into jsdom with a
 * `// @vitest-environment jsdom` docblock. Coverage spans every route,
 * component and library file with a 100% threshold, so an untested branch
 * anywhere fails the run.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    // axe over a full workspace takes seconds when every worker runs it at once.
    testTimeout: 30_000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.ts",
        "proxy.ts",
        "next.config.ts",
      ],
      exclude: ["**/*.d.ts"],
      reporter: ["text-summary", "html", "lcov"],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
