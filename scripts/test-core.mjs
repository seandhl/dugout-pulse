import { spawnSync } from "node:child_process";
import { rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
rmSync("coverage/core-raw", { recursive: true, force: true });
const test = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run"],
  { stdio: "inherit", env: { ...process.env, CORE_COVERAGE: "1" } },
);
if (test.error || test.status !== 0) process.exit(test.status || 1);
const targets = [
  "src/stats/batting.ts",
  "src/stats/pitching.ts",
  "src/stats/momentum.ts",
  "src/server/ingest/gate.ts",
  "src/server/ingest/admin.ts",
];
const rows = targets.map((file) => ({ file, functions: new Map() }));
for (const file of readdirSync("coverage/core-raw")) {
  for (const script of JSON.parse(
    readFileSync(`coverage/core-raw/${file}`, "utf8"),
  ).result) {
    const row = rows.find((row) =>
      script.url.split("?")[0].endsWith("/" + row.file),
    );
    if (!row) continue;
    for (const fn of script.functions) {
      // Exclude the module evaluation wrapper; include named and anonymous functions.
      if (!fn.functionName || fn.functionName === "__vite_ssr_import__")
        continue;
      const range = fn.ranges[0];
      const key = `${fn.functionName}:${range.startOffset}:${range.endOffset}`;
      row.functions.set(
        key,
        (row.functions.get(key) ?? false) || range.count > 0,
      );
    }
  }
}
const summary = rows.map(({ file, functions }) => {
  const covered = [...functions.values()].filter(Boolean).length;
  return {
    file,
    covered,
    total: functions.size,
    percent: functions.size ? (covered / functions.size) * 100 : 0,
    uncovered: [...functions].filter(([, hit]) => !hit).map(([key]) => key),
  };
});
writeFileSync(
  "coverage/core-summary.json",
  JSON.stringify(
    {
      metric: "V8 named-function coverage (not line or branch coverage)",
      thresholdPerFile: 85,
      files: summary,
    },
    null,
    2,
  ) + "\n",
);
console.table(
  summary.map(({ file, covered, total, percent }) => ({
    file,
    covered,
    total,
    percent,
  })),
);
if (summary.some((row) => row.total === 0 || row.percent < 85)) process.exit(1);
