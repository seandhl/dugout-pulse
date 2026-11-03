import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPipeline } from "../../src/server/ingest/pipeline";
import { parseFile, type Kind } from "../../src/server/ingest/files";
import {
  assertCanonicalPublication,
  selectedPublication,
  publicationIdentity,
  withPublication,
} from "../../src/server/repositories/publication";
import { selectPlayerDetail } from "../../src/server/reads/player-detail";
import { selectPitcherDetail } from "../../src/server/reads/pitcher-detail";
import { selectComparison } from "../../src/server/reads/compare";
import { selectDirectory } from "../../src/server/reads/player-directory";
import { directoryQuery } from "../../src/contracts/player-directory";
import { compareQuery } from "../../src/server/reads/compare";
const faults = vi.hoisted(() => ({ commit: false }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return {
    ...fs,
    rename: async (...args: Parameters<typeof fs.rename>) => {
      if (faults.commit) {
        faults.commit = false;
        throw Error("commit fault");
      }
      return fs.rename(...args);
    },
  };
});
const dirs: string[] = [];
afterEach(async () => {
  faults.commit = false;
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "pulse-linked-"));
  dirs.push(dir);
  const filename = join(dir, "state.json");
  const p = createPipeline(
    dir,
    undefined,
    () => assertCanonicalPublication(filename),
    true,
  );
  const load = (id?: string) =>
    withPublication(id, () => selectedPublication(filename)!);
  async function stage(
    kind: Kind,
    variant = "",
    edit?: (rows: Record<string, unknown>[]) => void,
  ) {
    const rows = parseFile(
      await readFile(`fixtures/ingest/${kind}${variant}.json`),
      `${kind}.json`,
    ) as Record<string, unknown>[];
    edit?.(rows);
    return p.stage(kind, Buffer.from(JSON.stringify(rows)), rows);
  }
  async function publish(kind: Kind, variant = "") {
    return p.publish((await stage(kind, variant)).importBatchId);
  }
  return { dir, filename, p, load, stage, publish };
}
it("publishes one complete release for home, directory, detail, comparison, rankings and published records; corrects and rolls back atomically", async () => {
  const { p, load, publish, stage } = await setup();
  for (const kind of [
    "players",
    "games",
    "rosters",
    "batting_game_logs",
    "pitching_game_logs",
  ] as Kind[]) {
    const result =
      kind === "rosters"
        ? await p.publish(
            (
              await stage(kind, "", (rows) => {
                rows.push({
                  ...rows[0],
                  external_player_id: "demo_ext_2",
                  team_id: "demo_team_2",
                });
              })
            ).importBatchId,
          )
        : await publish(kind);
    expect(result.published, JSON.stringify(result.report.issues)).toBe(true);
  }
  const before = load();
  expect(before.revision).toBe(5);
  expect(before.fixture.players).toHaveLength(2);
  expect(
    before.fixture.players.some((p) => p.playerId.startsWith("demo_0_")),
  ).toBe(false);
  expect(Object.keys(before.homes)).toHaveLength(12);
  expect(before.fixture.asOf).toBe(before.asOf);
  expect(before.fixture.games[0].revision).toBe(before.revision);
  expect(before.state.momentumCurrent?.length).toBeGreaterThan(0);
  const detail = selectPlayerDetail(before.fixture, "demo_player_1", "10")!;
  expect(detail.season.totals.h).toBe(2);
  expect(detail.asOf).toBe(before.asOf);
  expect(
    before.provenance[detail.games[0].inputRef].some(
      (ref) =>
        ref.key.includes("batting_game_logs") &&
        ref.licenseId === "demo-self-authored-v1",
    ),
  ).toBe(true);
  expect(
    selectPitcherDetail(before.fixture, "demo_player_2", "starter", "5")?.recent
      .totals.outsRecorded,
  ).toBe(20);
  expect(
    selectDirectory(
      before.fixture,
      directoryQuery.parse({}),
      before.homes["batter/10"].players,
    ).asOf,
  ).toBe(before.asOf);
  expect(
    selectComparison(
      before.fixture,
      compareQuery.parse({ players: "demo_player_1,demo_player_2" }),
    ),
  ).toBeDefined();
  const corrected = await publish("batting_game_logs", "-correction");
  const after = load();
  expect(after.revision).toBe(before.revision + 1);
  expect(after.releaseId).not.toBe(before.releaseId);
  expect(
    selectPlayerDetail(after.fixture, "demo_player_1", "10")!.season.totals.h,
  ).toBe(3);
  expect(load(before.releaseId)).toEqual(before);
  expect(after.state.records).toEqual((await p.read()).records);
  await p.rollback(corrected.report.importBatchId);
  const rollback = load();
  expect(rollback.revision).toBe(after.revision + 1);
  expect(rollback.releaseId).not.toBe(before.releaseId);
  expect(rollback.fixture.games[0].batting[0].h).toBe(2);
  expect(load(after.releaseId)).toEqual(after);
});
it("keeps one request pinned while publication commits, and rejects unknown IDs and corrupt or legacy projections", async () => {
  const { filename, p, load, publish } = await setup();
  await publish("players");
  const first = load();
  await withPublication(undefined, async () => {
    const pinned = selectedPublication(filename);
    await publish("games");
    expect(selectedPublication(filename)).toBe(pinned);
    expect((await p.readPublicState()).revision).toBe(first.revision);
  });
  expect(load().revision).toBe(2);
  expect(() => load("missing")).toThrow("게시 릴리스 연결 대기");
  const state = await p.read();
  state.releases![state.publication!.releaseId].release.homes = {};
  await writeFile(filename, JSON.stringify(state));
  expect(() => load()).toThrow("게시 릴리스 연결 대기");
});
it("leaves active release unchanged on projection and atomic commit failures, then recovers by retry", async () => {
  const { p, load, stage, publish } = await setup();
  for (const k of ["players", "games", "rosters"] as Kind[]) await publish(k);
  const before = load();
  const incomplete = await stage("batting_game_logs", "", (rows) => {
    delete rows[0].bb;
  });
  await expect(p.publish(incomplete.importBatchId)).rejects.toThrow(
    "누락 수치를 추정하지 않습니다",
  );
  expect(load()).toEqual(before);
  const ready = await stage("batting_game_logs");
  faults.commit = true;
  await expect(p.publish(ready.importBatchId)).rejects.toThrow("commit fault");
  expect(load()).toEqual(before);
  expect(
    (await p.read()).batches[ready.importBatchId].publishedAt,
  ).toBeUndefined();
  await p.publish(ready.importBatchId);
  expect(load().revision).toBe(before.revision + 1);
  expect(load().fixture.games[0].batting[0].h).toBe(2);
});

it("preserves the dedicated performance fixture identity and refuses a different baseline profile", async () => {
  const { filename } = await setup();
  vi.stubEnv("DEMO_PROFILE", "performance");
  try {
    withPublication("synthetic_performance_v1", () => {
      expect(selectedPublication(filename)).toBeUndefined();
      expect(publicationIdentity().releaseId).toBe("synthetic_performance_v1");
    });
    expect(() =>
      withPublication("synthetic_v2", () => selectedPublication(filename)),
    ).toThrow("게시 릴리스 연결 대기");
  } finally {
    vi.unstubAllEnvs();
  }
});
