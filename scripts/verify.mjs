import { spawnSync } from "node:child_process";
const steps = [
  ["lint", "pnpm", ["lint"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["unit / integration + core coverage", "node", ["scripts/test-core.mjs"]],
  ["migration validation", "node", ["scripts/validate-migrations.mjs"]],
  ["production build", "pnpm", ["build"]],
  ["public E2E", "pnpm", ["test:e2e"]],
  ["admin E2E", "pnpm", ["test:ingest:e2e"]],
];
const env = {
  ...process.env,
  DATA_MODE: "DEMO",
  DEMO_PROFILE: "default",
  CI: "1",
  VERIFY_PRODUCTION: "1",
  ADMIN_ORIGIN: "",
};
// Full verification must own its local server, never target an inherited URL.
delete env.PLAYWRIGHT_BASE_URL;
for (const [name, command, args] of steps) {
  console.log(`\n>>> ${name}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  });
  if (result.error || result.status !== 0) {
    console.error(`FAILED: ${name}`, result.error ?? "");
    process.exit(result.status || 1);
  }
}
console.log("PASS: all verification stages");
