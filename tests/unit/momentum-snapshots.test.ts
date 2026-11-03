import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createPipeline,
  pipeline,
  type PipelineState,
} from "../../src/server/ingest/pipeline";
import { fixture } from "../../fixtures/stats/momentum-input";
import { momentumView, publishMomentum } from "../../src/server/reads/momentum";
import { type Kind } from "../../src/server/ingest/files";
import { GET as rankings } from "../../src/app/api/v1/rankings/route";
import { GET as momentum } from "../../src/app/api/v1/players/[id]/momentum/route";
const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});
const query = {
  season: 2026,
  competition: "regular",
  role: "hitter" as const,
  window: 10,
};
async function seed() {
  const dir = await mkdtemp(path.join(tmpdir(), "momentum-snapshots-"));
  dirs.push(dir);
  const p = createPipeline(dir);
  const input = fixture();
  input.rows = input.rows.map((r) => ({
    ...r,
    playerId: `demo_${r.playerId}`,
    gameId: `demo_${r.gameId}`,
  }));
  const scope = {
    season: 2026,
    competition: "regular",
    as_of: "2026-10-21T13:00:00Z",
  };
  const players = [...new Set(input.rows.map((r) => r.playerId))].map((id) => ({
    ...scope,
    player_id: id,
    external_player_id: id,
    display_name: `DEMO ${id}`,
    role: "BATTER",
  }));
  const games = [...new Map(input.rows.map((r) => [r.gameId, r])).values()].map(
    (r) => ({
      ...scope,
      game_id: r.gameId,
      played_on: r.playedOn,
      scheduled_at_kst: `${r.playedOn}T09:00:00Z`,
      home_team_id: "demo_a",
      away_team_id: "demo_b",
      status: "FINAL",
    }),
  );
  const rosters = input.rows.map((r) => ({
    ...scope,
    external_player_id: r.playerId,
    team_id: "demo_a",
    snapshot_on: r.playedOn,
    effective_on: r.playedOn,
    status: "REGISTERED",
  }));
  const logs = input.rows.map((r) => ({
    ...scope,
    external_player_id: r.playerId,
    team_id: "demo_a",
    game_id: r.gameId,
    ...r.counts,
  }));
  async function publish(kind: Kind, rows: unknown[]) {
    const report = await p.stage(kind, Buffer.from(JSON.stringify(rows)), rows);
    const result = await p.publish(report.importBatchId);
    expect(result.published, JSON.stringify(result.report.issues)).toBe(true);
  }
  for (const [kind, rows] of [
    ["players", players],
    ["games", games],
    ["rosters", rosters],
    ["batting_game_logs", logs],
  ] as [Kind, unknown[]][])
    await publish(kind, rows);
  return { p, dir, logs, publish };
}
it("publishes corrected score and ranking atomically, retaining history and stable replay IDs after restart", async () => {
  const { p, dir, logs, publish } = await seed();
  const before = await p.read();
  const old = momentumView(before, query, "demo_target").data[0];
  expect(old.score).toBe(50);
  expect(old.rankingStatus).toBe("ranked");
  const corrected = { ...logs.at(-1)!, h: 3, doubles: 1, so: 0 };
  await publish("batting_game_logs", [corrected]);
  const state = await createPipeline(dir).read();
  const current = momentumView(state, query, "demo_target").data[0];
  expect(current.score).toBeGreaterThan(old.score!);
  expect(current.previousSnapshotId).toBe(old.id);
  expect(current.deltaScore).toBe(current.score! - old.score!);
  expect(current.comparisonBasis.previous).toEqual(old.comparisonBasis.current);
  const { comparisonBasis: oldBasis, ...storedOld } = old;
  expect(oldBasis.current.snapshotId).toBe(old.id);
  expect(state.momentumSnapshots![old.id]).toEqual(storedOld);
  const ranking = momentumView(state, { ...query, sort: "change" });
  expect(ranking.data.find((s) => s.playerId === "demo_target")?.id).toBe(
    current.id,
  );
  const count = Object.keys(state.momentumSnapshots!).length;
  await p.recalculateMomentum();
  expect((await p.read()).momentumCurrent).toEqual(state.momentumCurrent);
  expect(Object.keys((await p.read()).momentumSnapshots!)).toHaveLength(count);
  await publish("batting_game_logs", [corrected]);
  await p.recalculateMomentum();
  expect(momentumView(await p.read(), query, "demo_target").data[0]).toEqual(
    current,
  );
});
it("separates confidence, unscored, roster and roles; validates APIs and provides provenance", async () => {
  const { p } = await seed();
  const state = await p.read();
  const small = momentumView(state, { ...query, window: 3 }, "demo_target")
    .data[0];
  expect(small.rankingStatus).toBe("low_confidence");
  expect(momentumView(state, { ...query, window: 3 }).excluded).toContainEqual(
    small,
  );
  expect(momentumView(state, { ...query, role: "starter" }).data).toEqual([]);
  expect(
    momentumView(state, query).excluded.some(
      (s) => s.rankingStatus === "unscored",
    ),
  ).toBe(true);
  const roster = Object.values(state.records).find(
    (r) => r.kind === "rosters" && r.row.player_id === "demo_target",
  )!;
  // All latest roster rows carry the unregistered state for this policy test.
  for (const r of Object.values(state.records))
    if (r.kind === "rosters" && r.row.player_id === "demo_target")
      r.row.status = "UNREGISTERED";
  expect(roster).toBeDefined();
  state.revision++;
  publishMomentum(state, "2026-11-03T00:00:00Z");
  expect(momentumView(state, query, "demo_target").data[0].rankingStatus).toBe(
    "inactive_roster",
  );
  vi.spyOn(pipeline, "readPublicState").mockResolvedValue(state);
  vi.spyOn(pipeline, "publicResults").mockResolvedValue(
    await p.publicResults(2026, "regular"),
  );
  const response = await momentum(
    new Request(
      "http://localhost/api/v1/players/demo_target/momentum?role=hitter&window=10&season=2026",
    ),
    { params: Promise.resolve({ id: "demo_target" }) },
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data[0].sourceIds).toEqual(["demo-file-source"]);
  expect(body.data[0].asOf).toBeTruthy();
  expect(body.data[0].explanation.asOf).toBe(body.data[0].asOf);
  for (const params of [
    "role=starter&window=3&sort=change",
    "role=reliever&window=20&sort=score",
  ])
    expect(
      (
        await rankings(
          new Request(`http://localhost/api/v1/rankings?${params}`),
        )
      ).status,
    ).toBe(200);
  for (const params of [
    "role=all",
    "role=hitter&window=7",
    "role=hitter&role=starter",
    "role=hitter&sort=bad",
  ])
    expect(
      (
        await rankings(
          new Request(`http://localhost/api/v1/rankings?${params}`),
        )
      ).status,
    ).toBe(400);
  expect(
    (
      await momentum(new Request("http://localhost/?role=hitter"), {
        params: Promise.resolve({ id: "missing" }),
      })
    ).status,
  ).toBe(404);
});
it("orders doubleheaders by game identity and excludes other model versions from delta", async () => {
  const { p } = await seed();
  const state: PipelineState = await p.read();
  const game = Object.values(state.records).find(
    (r) => r.kind === "games" && r.row.game_id === "demo_g19",
  )!;
  game.row.played_on = "2026-10-21";
  game.row.doubleheader_no = 1;
  const last = Object.values(state.records).find(
    (r) => r.kind === "games" && r.row.game_id === "demo_g20",
  )!;
  last.row.doubleheader_no = 2;
  for (const [i, s] of Object.values(state.momentumSnapshots!).entries()) {
    if (i % 2 === 0) s.algorithmVersion = "old-model";
    else s.modelVersion = "old-model";
  }
  state.revision++;
  publishMomentum(state, "2026-11-03T00:00:00Z");
  const result = momentumView(state, query, "demo_target").data[0];
  expect(result.dataAsOfGameId).toBe("demo_g20");
  expect(result.previousSnapshotId).toBeNull();
  expect(result.sampleSize).toBe(10);
});

it("keeps IDs stable when stored input order changes and uses role-specific defaults", async () => {
  const { p } = await seed();
  const state = await p.read();
  const original = [...state.momentumCurrent!].sort();
  state.records = Object.fromEntries(Object.entries(state.records).reverse());
  publishMomentum(state, "2026-11-03T00:00:00Z");
  expect([...state.momentumCurrent!].sort()).toEqual(original);
  vi.spyOn(pipeline, "readPublicState").mockResolvedValue(state);
  const response = await rankings(
    new Request("http://localhost/?role=starter"),
  );
  expect((await response.json()).meta).toMatchObject({
    window: 5,
    windowBasis: "최근 선발 등판",
    recommendedWindow: 5,
  });
});

it.each(["starting_pitcher", "relief_pitcher"] as const)(
  "scores %s independently with pitching evidence",
  async (role) => {
    const input = fixture(role);
    const state: PipelineState = {
      version: 1,
      revision: 1,
      batches: {},
      history: [],
      records: {},
      events: [],
      audit: [],
      scores: {},
      aggregates: {},
    };
    const kindRole = role === "starting_pitcher" ? "STARTER" : "RELIEVER";
    const record = (
      kind: "players" | "games" | "rosters" | "pitching_game_logs",
      row: Record<string, unknown>,
    ) => ({
      kind,
      row,
      batchId: "synthetic",
      sourceId: "demo-file-source",
      licenseId: "demo-self-authored-v1",
    });
    for (const r of input.rows) {
      const scope = {
        season: 2026,
        competition: "regular",
        as_of: input.cutoffAt,
      };
      state.records[`player-${r.playerId}`] = record("players", {
        ...scope,
        player_id: r.playerId,
        role: kindRole,
      });
      state.records[`game-${r.gameId}`] = record("games", {
        ...scope,
        game_id: r.gameId,
        played_on: r.playedOn,
        doubleheader_no: 1,
        status: "FINAL",
      });
      state.records[`roster-${r.playerId}`] = record("rosters", {
        ...scope,
        player_id: r.playerId,
        status: "REGISTERED",
        snapshot_on: "2026-10-21",
      });
      state.records[`log-${r.playerId}-${r.gameId}`] = record(
        "pitching_game_logs",
        {
          ...scope,
          player_id: r.playerId,
          game_id: r.gameId,
          role: kindRole,
          ...r.counts,
          outs: r.counts.outsRecorded,
          walk_definition: "includes_ibb",
        },
      );
    }
    publishMomentum(state, input.cutoffAt);
    const publicRole = role === "starting_pitcher" ? "starter" : "reliever";
    const result = momentumView(
      state,
      { ...query, role: publicRole, window: publicRole === "starter" ? 5 : 10 },
      "target",
    ).data[0];
    expect(result.score).toBe(50);
    expect(result.rankingStatus).toBe("ranked");
    expect(momentumView(state, query).data).toEqual([]);
    expect(
      Object.values(state.momentumSnapshots!).every(
        (s) => s.role === publicRole,
      ),
    ).toBe(true);
  },
);

it("projects publication comparison metadata without rewriting stored snapshots", async () => {
  const { p } = await seed();
  const state = await p.read();
  const before = JSON.stringify(state.momentumSnapshots);
  const s = momentumView(state, query, "demo_target").data[0];
  expect(s.comparisonBasis.kind).toBe("previous_eligible_publication");
  expect(s.comparisonBasis.current).toMatchObject({
    season: s.season,
    competition: s.competition,
    role: s.role,
    window: s.window,
    modelVersion: s.modelVersion,
    snapshotId: s.id,
    asOf: s.asOf,
    sourceIds: s.sourceIds,
    inputRefs: s.inputRefs,
  });
  const previous = s.previousSnapshotId
    ? state.momentumSnapshots![s.previousSnapshotId]
    : null;
  expect(s.comparisonBasis.previous?.snapshotId ?? null).toBe(
    previous?.id ?? null,
  );
  expect(JSON.stringify(state.momentumSnapshots)).toBe(before);
});
