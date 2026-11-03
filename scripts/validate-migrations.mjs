import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// A disposable PostgreSQL database is required: never default to an application URL.
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw Error(
    "TEST_DATABASE_URL required (disposable PostgreSQL; see docs/TESTING.md)",
  );
const run = (args, input) => {
  const result = spawnSync(
    "psql",
    [url, "-X", "-v", "ON_ERROR_STOP=1", ...args],
    {
      input,
      encoding: "utf8",
      stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    },
  );
  if (result.error || result.status !== 0)
    throw Error(
      result.error
        ? "psql 실행 불가: PostgreSQL client 설치 여부를 확인하세요."
        : "migration SQL failed (see migration name and SQL error above)",
    );
};
const schema = `verify_${process.pid}`;
const dirs = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
if (!dirs.length) throw Error("No migrations found");
try {
  run([], `CREATE SCHEMA "${schema}";`);
  // One connection preserves search_path across migrations and transactional DDL.
  run(
    [],
    `SET search_path TO "${schema}";\n` +
      dirs
        .map(
          (d) =>
            `\\echo Applying ${d}\n` +
            readFileSync(`prisma/migrations/${d}/migration.sql`, "utf8"),
        )
        .join("\n") +
      `\nDO $$ BEGIN IF to_regclass('momentum_public_page') IS NULL THEN RAISE EXCEPTION 'ranking index missing'; END IF; END $$;`,
  );
  console.log(
    `PASS: ${dirs.length} PostgreSQL migrations applied to empty schema`,
  );
} finally {
  run([], `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
}
