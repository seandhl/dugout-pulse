import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { performancePanel } from "../performance/panel";
import { selectDirectory } from "../../src/server/reads/player-directory";
import { selectDirectory as baselineDirectory } from "../performance/baseline-directory";
import { selectRankingBoards } from "../../src/server/reads/ranking-boards";
import { selectRankingBoards as baselineRankings } from "../performance/baseline-rankings";
import { rankingsQuery, momentumResponse } from "../../src/contracts/momentum";
import { directoryQuery } from "../../src/contracts/player-directory";
import { boardQuery } from "../../src/contracts/ranking-boards";
import {
  momentumView,
  publishMomentum,
  publishMomentumBatched,
} from "../../src/server/reads/momentum";
const q = directoryQuery.parse({});
it("preserves indexed directory results and all board provenance on a deterministic large panel", () => {
  const { fixture, state } = performancePanel();
  expect(fixture.players).toHaveLength(600);
  expect(
    fixture.games.reduce((n, g) => n + g.batting.length + g.pitching.length, 0),
  ).toBeGreaterThan(50_000);
  for (const patch of [
    {},
    { q: "A-01", sort: "ops", page: "2" },
    { role: "starter", sort: "era" },
    { team: "sample_1", window: "20" },
  ]) {
    const query = directoryQuery.parse(patch);
    expect(selectDirectory(fixture, query)).toEqual(
      baselineDirectory(fixture, query),
    );
  }
  const bq = boardQuery.parse({ date: "2026-11-03" });
  const actual = selectRankingBoards(state, bq);
  const baseline = baselineRankings(state, bq);
  // This integer-score panel preserves ordering/provenance; ADR-030 changes ranks.
  expect({
    ...actual,
    boards: actual.boards.map(
      ({ excludedRows, ...board }) => (
        void excludedRows,
        {
          ...board,
          rows: board.rows.map(
            ({ rank, comparisonBasis, ...row }) => (
              void rank,
              void comparisonBasis,
              row
            ),
          ),
        }
      ),
    ),
  }).toEqual({
    ...baseline,
    boards: baseline.boards.map((board) => ({
      ...board,
      rows: board.rows.map(({ rank, ...row }) => (void rank, row)),
    })),
  });
  const first = momentumView(state, {
    season: 2026,
    competition: "regular",
    role: "hitter",
    window: 10,
    page: 1,
  });
  const second = momentumView(state, {
    season: 2026,
    competition: "regular",
    role: "hitter",
    window: 10,
    page: 2,
  });
  expect(first.data).toHaveLength(20);
  const score = second.data[0].score!;
  expect(second.data[0]).toMatchObject({
    rank:
      1 +
      Object.values(state.momentumSnapshots!).filter(
        (s) => s.role === "hitter" && s.score! > score,
      ).length,
  });
  expect(new Set([...first.data, ...second.data].map((s) => s.id)).size).toBe(
    40,
  );
  expect(first.pagination?.total).toBe(400);
  expect(momentumResponse.safeParse(first).success).toBe(true);
  for (const invalid of [{ page: "0" }, { page: "1e4" }, { limit: "21" }]) {
    expect(
      rankingsQuery.safeParse({ role: "hitter", ...invalid }).success,
    ).toBe(false);
  }
  // New publication objects cannot reuse aggregates, even with the same release label.
  const changed = structuredClone(fixture);
  changed.players[0].displayName = "수정된 DEMO";
  expect(selectDirectory(changed, { ...q, q: "수정된" }).players[0].name).toBe(
    "수정된 DEMO",
  );
}, 60_000);
it("batched recompute yields the event loop and preserves atomic computation results", async () => {
  const { state } = performancePanel();
  // No logs: measure scheduling without a costly scoring-model experiment.
  state.records = Object.fromEntries(
    Object.entries(state.records)
      .filter(([, r]) => r.kind === "players")
      .slice(0, 30),
  );
  const sync = structuredClone(state);
  const asyncState = structuredClone(state);
  publishMomentum(sync, "2026-11-03T00:00:00Z");
  let ticks = 0;
  // Match the check-phase yield rather than relying on timer millisecond rounding.
  let probe = setImmediate(function tick() {
    ticks++;
    probe = setImmediate(tick);
  });
  try {
    await publishMomentumBatched(asyncState, "2026-11-03T00:00:00Z");
  } finally {
    clearImmediate(probe);
  }
  expect(ticks).toBeGreaterThan(0);
  expect(asyncState).toEqual(sync);
});
it.skipIf(process.env.PERFORMANCE !== "1")(
  "records actual warm query timings and SQLite EXPLAIN before/after",
  () => {
    const { fixture, state } = performancePanel();
    const bq = boardQuery.parse({ date: "2026-11-03" });
    function measure(run: () => unknown, count = 15) {
      run();
      const ms: number[] = [];
      for (let i = 0; i < count; i++) {
        const start = performance.now();
        run();
        ms.push(performance.now() - start);
      }
      ms.sort((a, b) => a - b);
      return {
        samples: count,
        medianMs: ms[Math.floor(count / 2)],
        p95Ms: ms[Math.ceil(count * 0.95) - 1],
      };
    }
    const directoryBefore = measure(() => baselineDirectory(fixture, q));
    const coldStart = performance.now();
    selectDirectory(fixture, q);
    const directoryColdMs = performance.now() - coldStart;
    const directoryAfter = measure(() => selectDirectory(fixture, q));
    const rankingsBefore = measure(() => baselineRankings(state, bq), 5);
    const rankingsAfter = measure(() => selectRankingBoards(state, bq));
    const db = new DatabaseSync(":memory:");
    let database;
    try {
      db.exec(
        "CREATE TABLE logs (batch TEXT, player TEXT, role TEXT, game TEXT); BEGIN",
      );
      const insert = db.prepare("INSERT INTO logs VALUES (?, ?, ?, ?)");
      for (const g of fixture.games)
        for (const l of [...g.batting, ...g.pitching])
          insert.run("perf", l.playerId, l.role ?? "BATTER", g.gameId);
      db.exec("COMMIT");
      const sql =
        "SELECT game FROM logs WHERE batch=? AND player=? AND role=? ORDER BY game LIMIT 20";
      const params = ["perf", fixture.players[0].playerId, "BATTER"];
      const beforePlan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
      const before = measure(() => db.prepare(sql).all(...params), 100);
      db.exec(
        "CREATE INDEX logs_player_role_game ON logs(batch, player, role, game); ANALYZE",
      );
      const afterPlan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
      const after = measure(() => db.prepare(sql).all(...params), 100);
      database = {
        engine:
          "SQLite in-memory synthetic relational projection (not PostgreSQL)",
        beforePlan,
        afterPlan,
        before,
        after,
      };
    } finally {
      db.close();
    }
    const report = {
      measuredAt: new Date().toISOString(),
      node: process.version,
      cpu: cpus()[0].model,
      mode: "DEMO/no images",
      players: fixture.players.length,
      games: fixture.games.length,
      logs: fixture.games.reduce(
        (n, g) => n + g.batting.length + g.pitching.length,
        0,
      ),
      fixtureSha256: createHash("sha256")
        .update(JSON.stringify(fixture))
        .digest("hex"),
      fixtureBytes: Buffer.byteLength(JSON.stringify(fixture)),
      rssBytes: process.memoryUsage().rss,
      directoryBefore,
      directoryColdMs,
      directoryAfter,
      rankingsBefore,
      rankingsAfter,
      database,
    };
    mkdirSync("reports", { recursive: true });
    writeFileSync(
      "reports/performance.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    expect(directoryAfter.p95Ms).toBeLessThan(50);
    expect(rankingsAfter.p95Ms).toBeLessThan(250);
    expect(directoryAfter.p95Ms).toBeLessThan(directoryBefore.p95Ms);
    expect(rankingsAfter.p95Ms).toBeLessThan(rankingsBefore.p95Ms);
  },
  120_000,
);
