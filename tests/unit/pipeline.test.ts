import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeline, demoRights } from "../../src/server/ingest/pipeline";
import { parseFile, type Kind } from "../../src/server/ingest/files";
const faults = vi.hoisted(() => ({ failCommit: false }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (faults.failCommit) {
        faults.failCommit = false;
        throw new Error("injected commit failure");
      }
      return actual.rename(...args);
    },
  };
});
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), "dugout-pipeline-"));
  directories.push(dir);
  return { dir, pipeline: createPipeline(dir) };
}
async function sample(kind: Kind) {
  return parseFile(
    await readFile(`fixtures/ingest/${kind}.json`),
    `${kind}.json`,
  ) as Record<string, unknown>[];
}
async function upload(
  p: ReturnType<typeof createPipeline>,
  kind: Kind,
  rows?: unknown[],
) {
  const input = rows ?? (await sample(kind));
  return p.stage(kind, Buffer.from(JSON.stringify(input)), input);
}
async function publish(
  p: ReturnType<typeof createPipeline>,
  kind: Kind,
  rows?: unknown[],
) {
  const report = await upload(p, kind, rows);
  return p.publish(report.importBatchId);
}
async function seed(p: ReturnType<typeof createPipeline>) {
  for (const kind of [
    "players",
    "games",
    "rosters",
    "batting_game_logs",
  ] as Kind[])
    expect((await publish(p, kind)).published).toBe(true);
}
describe("transactional DEMO publication", () => {
  it("retains last-known-good records, derived values and outbox if commit fails", async () => {
    const { pipeline: p } = await setup();
    await seed(p);
    const correction = await sample("batting_game_logs");
    correction[0].h = 3;
    const staged = await upload(p, "batting_game_logs", correction);
    const before = await p.read();
    faults.failCommit = true;
    await expect(p.publish(staged.importBatchId)).rejects.toThrow(
      "injected commit failure",
    );
    expect(await p.read()).toEqual(before);
    expect((await p.publish(staged.importBatchId)).published).toBe(true);
    expect(
      Object.values((await p.publicResults(2026, "regular")).aggregates)[0].h,
    ).toBe(3);
  });
  it("requires explicit publish, upserts repeated uploads, recalculates corrections and retains provenance after restart", async () => {
    const { pipeline: p, dir } = await setup();
    const staged = await upload(p, "players");
    expect((await p.publicResults(2026, "regular")).records).toHaveLength(0);
    expect((await p.publish(staged.importBatchId)).published).toBe(true);
    await seed(p);
    const before = await p.publicResults(2026, "regular");
    expect(Object.values(before.aggregates)[0].h).toBe(2);
    const stats = Object.values(before.battingStats)[0];
    expect(stats.demo).toBe(true);
    expect(stats.season.totals.h).toBe(2);
    expect(stats.season.metrics.avg.value).toBe(0.5);
    expect(stats.season.metrics.obp.value).toBe(0.5);
    expect(stats.season.metrics.obp.reason).toBeNull();
    await seed(p);
    await seed(p);
    expect((await p.publicResults(2026, "regular")).records).toHaveLength(
      before.records.length,
    );
    const correction = await sample("batting_game_logs");
    correction[0].h = 3;
    correction[0].as_of = "2026-11-01T21:00:00";
    expect((await publish(p, "batting_game_logs", correction)).published).toBe(
      true,
    );
    const restarted = createPipeline(dir);
    const after = await restarted.publicResults(2026, "regular");
    expect(Object.values(after.aggregates)[0].h).toBe(3);
    expect(after.records).toHaveLength(before.records.length);
    const state = await restarted.read();
    expect(state.events.at(-1)?.type).toBe("RECALCULATE");
    expect(state.history.at(-1)?.before?.row.h).toBe(2);
    expect(state.history.at(-1)?.after?.row.h).toBe(3);
    expect(state.batches[staged.importBatchId].raw).toBeTruthy();
    const stale = await publish(p, "batting_game_logs");
    expect(stale.published).toBe(false);
    expect(stale.report.issues.some((i) => i.code === "STALE_CORRECTION")).toBe(
      true,
    );
  });
  it("aborts entire batch on row errors, identity collisions or missing scoped references", async () => {
    const { pipeline: p } = await setup();
    await seed(p);
    const before = await p.publicResults(2026, "regular");
    const players = await sample("players");
    players[0].player_id = "demo_intruder";
    const conflict = await publish(p, "players", players);
    expect(conflict.published).toBe(false);
    expect(conflict.report.issues[0]).toMatchObject({
      row: 1,
      code: "IDENTITY_CONFLICT",
    });
    const logs = await sample("batting_game_logs");
    logs[0].competition = "postseason";
    expect((await publish(p, "batting_game_logs", logs)).published).toBe(false);
    const invalid = [...(await sample("players")), { season: 2026 }];
    const report = await upload(p, "players", invalid);
    expect(report.issues[0].message).toBeTruthy();
    expect((await p.publish(report.importBatchId)).published).toBe(false);
    expect(await p.publicResults(2026, "regular")).toEqual(before);
  });
  it("preserves names and dated transfers, separates doubleheaders and competitions", async () => {
    const { pipeline: p } = await setup();
    await seed(p);
    const players = await sample("players");
    players[0].display_name = "DEMO 개명";
    expect((await publish(p, "players", players)).published).toBe(true);
    const games = await sample("games");
    games[0].game_id = "demo_game_2";
    games[0].doubleheader_no = 2;
    expect((await publish(p, "games", games)).published).toBe(true);
    const logs = await sample("batting_game_logs");
    logs[0].game_id = "demo_game_2";
    expect((await publish(p, "batting_game_logs", logs)).published).toBe(true);
    games[0].game_id = "demo_game_3";
    expect((await publish(p, "games", games)).published).toBe(false);
    games[0].played_on = "2026-11-01";
    games[0].doubleheader_no = 1;
    expect((await publish(p, "games", games)).published).toBe(true);
    const roster = await sample("rosters");
    roster[0].snapshot_on = "2026-11-01";
    roster[0].effective_on = "2026-11-01";
    roster[0].as_of = "2026-11-01T21:00:00";
    roster[0].team_id = "demo_team_2";
    expect((await publish(p, "rosters", roster)).published).toBe(true);
    logs[0].game_id = "demo_game_3";
    logs[0].as_of = "2026-11-01T21:00:00";
    logs[0].team_id = "demo_team_2";
    expect((await publish(p, "batting_game_logs", logs)).published).toBe(true);
    expect(
      Object.values((await p.publicResults(2026, "regular")).aggregates)[0]
        .sampleSize,
    ).toBe(3);
    expect((await p.publicResults(2026, "postseason")).records).toHaveLength(0);
  });
  it.each(["CANCELLED", "POSTPONED", "SUSPENDED"])(
    "retracts %s logs, requires official final for resumed games",
    async (status) => {
      const { pipeline: p } = await setup();
      await seed(p);
      const games = await sample("games");
      games[0].status = status;
      expect((await publish(p, "games", games)).published).toBe(true);
      expect((await p.publicResults(2026, "regular")).aggregates).toEqual({});
      games[0].status = "FINAL";
      games[0].resumed = true;
      expect((await publish(p, "games", games)).published).toBe(false);
      games[0].official_final = true;
      expect((await publish(p, "games", games)).published).toBe(true);
      expect((await publish(p, "batting_game_logs")).published).toBe(true);
    },
  );
  it("fails closed on revoked rights and commit contention, retaining last-known-good", async () => {
    const { pipeline: p, dir } = await setup();
    await seed(p);
    const before = await p.publicResults(2026, "regular");
    const denied = createPipeline(dir, {
      ...demoRights,
      displayAllowed: false,
    } as unknown as typeof demoRights);
    await expect(denied.publicResults(2026, "regular")).rejects.toThrow(
      "licenseId",
    );
    const report = await upload(p, "players");
    await expect(denied.publish(report.importBatchId)).rejects.toThrow(
      "licenseId",
    );
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(dir, "lock"));
    await expect(p.publish(report.importBatchId)).rejects.toThrow("진행 중");
    expect(await p.publicResults(2026, "regular")).toEqual(before);
    await rm(path.join(dir, "lock"), { recursive: true });
    const state = await p.read();
    state.scores.old = { value: 99 };
    await writeFile(path.join(dir, "state.json"), JSON.stringify(state));
    const correction = await sample("batting_game_logs");
    correction[0].h = 3;
    await publish(p, "batting_game_logs", correction);
    expect((await p.read()).scores).toEqual({});
    expect((await p.read()).events.at(-1)?.invalidated).toEqual(["old"]);
  });
});
