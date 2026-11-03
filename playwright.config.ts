import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "ingest.spec.ts",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          process.env.VERIFY_PRODUCTION === "1"
            ? `pnpm db:seed && pnpm start --port ${port}`
            : `pnpm db:seed && pnpm dev --port ${port}`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
      },
});
