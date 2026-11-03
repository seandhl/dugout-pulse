import { defineConfig, devices } from "@playwright/test";
import { createHash } from "node:crypto";
const token = process.env.TEST_INGEST_ADMIN_TOKEN;
if (!token)
  throw new Error(
    "Run node scripts/ingest-e2e.mjs to create an ephemeral test credential",
  );
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "ingest.spec.ts",
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/admin", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    env: {
      INGEST_E2E: "1",
      ADMIN_ORIGIN: "http://127.0.0.1:3101",
      ADMIN_ACTOR_ID: "e2e-operator",
      ADMIN_SESSION_SECRET: createHash("sha512").update(token).digest("hex"),
      INGEST_ADMIN_TOKEN_SHA256: createHash("sha256")
        .update(token)
        .digest("hex"),
    },
  },
});
