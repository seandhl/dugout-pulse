import ts from "typescript";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const temp = await mkdtemp(join(tmpdir(), "momentum-validation-"));
try {
  for (const name of [
    "src/stats/batting",
    "src/stats/pitching",
    "src/stats/momentum",
    "src/stats/momentum-validation",
    "fixtures/stats/momentum-input",
  ]) {
    const source = await readFile(join(root, `${name}.ts`), "utf8");
    const output = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/(from\s+["'])(\.[^"']+)(["'])/g, "$1$2.mjs$3");
    const target = join(temp, `${name}.mjs`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output);
  }
  const { evaluate, distribution, actualBacktestGate, rankingVolatility } =
    await import(
      pathToFileURL(join(temp, "src/stats/momentum-validation.mjs"))
    );
  if (process.argv[2] === "--actual") {
    const manifest = JSON.parse(await readFile(process.argv[3], "utf8"));
    actualBacktestGate(manifest);
  }
  if (process.argv.length > 2)
    throw Error(
      "Usage: node scripts/momentum-validation.mjs [--actual manifest.json]",
    );
  const { momentumScenario } = await import(
    pathToFileURL(join(temp, "fixtures/stats/momentum-input.mjs"))
  );
  const roles = ["hitter", "starting_pitcher", "relief_pitcher"];
  const inputs = roles.flatMap((role) =>
    ["neutral", "up", "down", "sample", "baseline"].map((v) =>
      momentumScenario(role, v),
    ),
  );
  const rows = evaluate(
    inputs,
    inputs.map(() => "momentum_v0_1_0"),
  );
  const summary = roles.map((role) => {
    const group = rows.filter((r) => r.role === role),
      ready = group.filter((r) => r.score !== null);
    return {
      role,
      score: distribution(ready.map((r) => r.score)),
      reliability: distribution(ready.map((r) => r.reliability)),
      confidence: group.map((r) => r.confidence ?? r.status),
      near50: ready.filter((r) => Math.abs(r.score - 50) <= 5).length,
      meanNeutralDistance: distribution(
        ready.map((r) => Math.abs(r.score - 50)),
      ),
      meanUnshrunkDistance: distribution(
        ready.map((r) => Math.abs(r.unshrunkScore - 50)),
      ),
      labelCutoffSensitivity: [55, 60, 65].map((cutoff) => ({
        cutoff,
        up: ready.filter((r) => r.score >= cutoff).length,
        down: ready.filter((r) => r.score <= 100 - cutoff).length,
      })),
    };
  });
  const cutoffSensitivity = inputs.map((input) => {
    const offsets = [-24, -1, 0, 24];
    return {
      role: input.role,
      rows: offsets.map((hours) => {
        const cutoffAt = new Date(
          Date.parse(input.cutoffAt) + hours * 3600000,
        ).toISOString();
        if (Date.parse(input.roster.asOf) > Date.parse(cutoffAt))
          return { hours, status: "future_roster_rejected" };
        const result = evaluate(
          [{ ...input, cutoffAt }],
          ["momentum_v0_1_0"],
        )[0];
        return { hours, status: result.status, score: result.score };
      }),
    };
  });
  const syntheticRanking = roles.map((role) => {
    const panel = inputs
      .filter((i) => i.role === role)
      .slice(0, 3)
      .map((i, index) => ({
        ...i,
        playerId: `synthetic-${index}`,
        rows: i.rows.map((r) =>
          r.playerId === "target"
            ? { ...r, playerId: `synthetic-${index}` }
            : r,
        ),
      }));
    const snapshots = [0, 24].map((hours) =>
      evaluate(
        panel.map((i) => ({
          ...i,
          cutoffAt: new Date(
            Date.parse(i.cutoffAt) + hours * 3600000,
          ).toISOString(),
        })),
        panel.map(() => "momentum_v0_1_0"),
      )
        .filter((r) => r.score !== null)
        .map((r) => ({ playerId: r.playerId, score: r.score })),
    );
    return { role, ...rankingVolatility(...snapshots) };
  });
  const report = {
    status: "actual backtest not run",
    mode: "DEMO synthetic sanity test",
    scoringVersion: "momentum_v0_1_0",
    futureOutcomeExperiment: "not run; no predictive claim",
    summary,
    rows,
    cutoffSensitivity,
    rankingVolatility: {
      mode: "synthetic cloned scenarios; unchanged logs at +24h, not real ranking stability",
      rows: syntheticRanking,
    },
  };
  await writeFile(
    join(root, "reports/momentum-validation.synthetic.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const table = [
    "role,scenarioIndex,scoringVersion,experimentId,tauMultiplier,temperature,firstFeatureWeightMultiplier,baseScore,score,change",
  ];
  rows.forEach((r, index) =>
    r.sensitivity?.forEach((s) =>
      table.push(
        [
          r.role,
          index,
          r.scoringVersion,
          s.experimentId,
          s.tauMultiplier,
          s.temperature,
          s.firstFeatureWeightMultiplier,
          r.score,
          s.score,
          s.change,
        ].join(","),
      ),
    ),
  );
  await writeFile(
    join(root, "reports/momentum-sensitivity.synthetic.csv"),
    table.join("\n") + "\n",
  );
  console.log(JSON.stringify({ status: report.status, summary }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
