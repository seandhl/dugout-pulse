import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
// Ephemeral capability inherited by Playwright's config loader and every worker.
const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config", "playwright.ingest.config.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_INGEST_ADMIN_TOKEN: randomBytes(32).toString("hex"),
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", () => {
  process.exitCode = 1;
});
