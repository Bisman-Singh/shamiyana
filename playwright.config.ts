import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end runs against the production build, so run `next build` first.
 * The server has no Gemini key, so specs that need AI answers mock
 * /api/plan, /api/refine and /api/vision at the network layer; the app code
 * has no test switches of its own.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { GOOGLE_GENERATIVE_AI_API_KEY: "" },
  },
});
