import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeline } from "../../src/server/ingest/pipeline";
import { date, kst, schemas, type Kind } from "../../src/server/ingest/files";
import { kstDate, scopeInput, scopeView } from "../../src/server/reads/scope";
describe("KST freshness and first-team scope", () => {
  it("validates leap days and KST midnight without host timezone dependence", () => {
    expect(date.safeParse("2026-02-29").success).toBe(false);
    expect(date.parse("2028-02-29")).toBe("2028-02-29");
    expect(kst.parse("2026-11-01T00:00:00")).toBe("2026-10-31T15:00:00.000Z");
    expect(kstDate("2026-10-31T15:00:00Z")).toBe("2026-11-01");
    expect(kst.safeParse("2026-02-30T12:00:00").success).toBe(false);
    expect(kst.safeParse("2026-11-01T24:00:00").success).toBe(false);
    expect(scopeInput.parse({ season: 2028 }).competition).toBe("regular");
  });
  it("separates snapshots, appearances, competitions and stale corrections after restart", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dugout-scope-"));
    try {
      const p = createPipeline(dir);
      const publish = async (kind: Kind, rows: unknown[]) => {
        const staged = await p.stage(
          kind,
          Buffer.from(JSON.stringify(rows)),
          rows,
        );
        return p.publish(staged.importBatchId);
      };
      const samples: Partial<Record<Kind, Record<string, unknown>[]>> = {};
      for (const kind of [
        "players",
        "games",
        "rosters",
        "batting_game_logs",
      ] as Kind[]) {
        const rows = JSON.parse(
          await readFile(`fixtures/ingest/${kind}.json`, "utf8"),
        );
        samples[kind] = rows;
        expect((await publish(kind, rows)).published).toBe(true);
      }
      const query = scopeInput.parse({
        season: 2026,
        date: "2026-10-31",
        search: "registered",
      });
      const result = await createPipeline(dir).scope(query);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].lastAppearanceDate).toBe("2026-10-31");
      expect(result.gameLogs).toHaveLength(1);
      expect(result.teamHistory[0].asOfDate).toBe("2026-10-31");
      const next = await p.scope({ ...query, date: "2026-11-01" });
      expect(next.rosterMessage).toBe("엔트리 정보 없음");
      expect(next.players).toHaveLength(0);
      expect(
        (await p.scope({ ...query, date: "2026-11-01", search: "appeared" }))
          .players,
      ).toHaveLength(1);
      expect(
        (await p.scope({ ...query, competition: "allstar" })).players,
      ).toHaveLength(0);
      expect(
        (
          await publish("rosters", [
            {
              ...samples.rosters![0],
              valid_until: "2026-11-02",
              as_of: "2026-11-01T21:00:00",
            },
          ])
        ).published,
      ).toBe(true);
      expect(
        (await p.scope({ ...query, date: "2026-11-01" })).players,
      ).toHaveLength(1);
      expect(
        (await p.scope({ ...query, date: "2026-11-03" })).rosterMessage,
      ).toBe("엔트리 정보 없음");
      const roster = {
        ...samples.rosters![0],
        as_of: "2026-11-01T21:00:00",
        snapshot_on: "2026-11-01",
        effective_on: "2026-11-01",
        team_id: "demo_team_2",
        status: "UNKNOWN",
      };
      expect((await publish("rosters", [roster])).published).toBe(true);
      expect(
        (await p.scope({ ...query, date: "2026-11-01" })).rosterStatus,
      ).toBe("NO_ENTRY_INFORMATION");
      expect(
        schemas.rosters.safeParse({ ...roster, as_of: "2026-10-31T21:00:00" })
          .success,
      ).toBe(false);
      expect(
        (
          await publish("rosters", [
            { ...roster, as_of: "2026-11-01T20:00:00" },
          ])
        ).published,
      ).toBe(false);
      const state = await p.read();
      const view = scopeView(
        state,
        query,
        Object.values(state.records),
        "2026-11-10T00:00:00Z",
      );
      expect(view.stale).toBe(true);
      const boundary = new Date(
        Date.parse(view.asOf!) + view.policy.staleThresholdHours * 3600000,
      ).toISOString();
      expect(
        scopeView(state, query, Object.values(state.records), boundary).stale,
      ).toBe(false);
      expect(
        scopeView(
          state,
          query,
          Object.values(state.records),
          new Date(Date.parse(boundary) + 1).toISOString(),
        ).stale,
      ).toBe(true);
      expect(view.pipeline.lastSuccessful).toBeTruthy();
      expect(view.pipeline.runs.at(-1)?.failReason).toContain("오래된 정정");
      const coach = {
        ...samples.players![0],
        external_player_id: "demo_coach",
        player_id: "demo_coach",
        person_type: "COACH",
        role: "COACH",
      };
      expect((await publish("players", [coach])).published).toBe(true);
      expect(
        (
          await publish("rosters", [
            {
              ...samples.rosters![0],
              external_player_id: "demo_coach",
              person_type: "COACH",
            },
          ])
        ).published,
      ).toBe(true);
      expect((await p.scope(query)).players).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
