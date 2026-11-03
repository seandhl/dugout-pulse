// No Prisma runtime is installed. This explicit SQL ledger is independent of Prisma.
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
if (!process.env.PGSERVICE || process.env.CONFIRM_DEMO_DB !== "yes")
  throw Error(
    "PGSERVICE and CONFIRM_DEMO_DB=yes required; use a separate empty DEMO database",
  );
const dirs = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
let sql = `SELECT pg_advisory_lock(72813001);
CREATE TABLE IF NOT EXISTS public.dugout_deploy_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
`;
for (const name of dirs) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw Error("Invalid migration name");
  const raw = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex");
  sql += String.raw`SELECT EXISTS(SELECT FROM public.dugout_deploy_migrations WHERE name='${name}') AS applied \gset
\if :applied
DO $$ BEGIN IF NOT EXISTS(SELECT FROM public.dugout_deploy_migrations WHERE name='${name}' AND checksum='${hash}') THEN RAISE EXCEPTION 'migration checksum mismatch'; END IF; END $$;
\else
BEGIN;
${raw.replace(/^BEGIN;\s*$/gm, "").replace(/^COMMIT;\s*$/gm, "")}
INSERT INTO public.dugout_deploy_migrations(name,checksum) VALUES ('${name}','${hash}');
COMMIT;
\endif
`;
}
const result = spawnSync(
  "psql",
  ["-X", "-v", "ON_ERROR_STOP=1", "--no-password"],
  {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
    env: {
      ...process.env,
      PGOPTIONS:
        "-c search_path=public -c lock_timeout=10s -c statement_timeout=120s",
    },
  },
);
if (result.error || result.status !== 0)
  throw Error("SQL deploy failed; inspect database ledger before retry");
console.log("PASS: SQL migration deploy (not Prisma migrate deploy)");
