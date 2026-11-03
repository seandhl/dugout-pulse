import { describe, it, expect } from "vitest";
import { generate } from "../../src/demo/generator";
import { directoryQuery } from "../../src/contracts/player-directory";
import { selectDirectory } from "../../src/server/reads/player-directory";
const fixture = generate();
const select = (q: Record<string, string> = {}) =>
  selectDirectory(fixture, directoryQuery.parse(q));
describe("server player directory", () => {
  it("paginates appeared players from the 150-player fixture deterministically", () => {
    expect(fixture.players).toHaveLength(150);
    const total = select().total;
    expect(total).toBeGreaterThanOrEqual(60);
    const ids = Array.from({ length: Math.ceil(total / 20) }, (_, i) =>
      select({ page: String(i + 1) }).players.map((p) => p.id),
    ).flat();
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });
  it("filters by Korean name, NFC, and retains distinct IDs for homonyms", () => {
    const f = structuredClone(fixture);
    f.players[0].displayName = "김민수";
    f.players[1].displayName = "김민수";
    const result = selectDirectory(
      f,
      directoryQuery.parse({ q: "김민수".normalize("NFD") }),
    );
    expect(result.total).toBe(2);
    expect(result.players[0].id).not.toBe(result.players[1].id);
  });
  it("filters role, team appearance history and preserves missing metrics", () => {
    expect(select({ role: "starter" }).total).toBe(30);
    expect(
      select({ team: "sample_1" }).players.some((p) => p.id === "demo_0_00"),
    ).toBe(true);
    expect(
      select({ role: "hitter" }).players.every(
        (p) => p.ops === null && p.era === null,
      ),
    ).toBe(true);
    expect(
      select({ role: "reliever", window: "3" }).players.every(
        (p) => p.games <= 3,
      ),
    ).toBe(true);
  });
  it("sorts ERA ascending with null last and restores serialized conditions", () => {
    const q = { role: "starter", sort: "era", window: "5", team: "sample_0" };
    const a = select(q);
    expect(a).toEqual(select(Object.fromEntries(new URLSearchParams(q))));
    expect(a.players.map((p) => p.era)).toEqual(
      a.players
        .map((p) => p.era)
        .sort((a, b) => (a ?? Infinity) - (b ?? Infinity)),
    );
  });
  it("handles empty matches, missing records, stale pages and invalid input", () => {
    expect(select({ q: "없는선수" }).total).toBe(0);
    expect(select({ page: "999" }).page).toBe(select().pages);
    const f = structuredClone(fixture);
    f.games = [];
    expect(selectDirectory(f, directoryQuery.parse({})).total).toBe(0);
    expect(directoryQuery.safeParse({ membership: "current" }).success).toBe(
      false,
    );
    expect(directoryQuery.safeParse({ page: "-1" }).success).toBe(false);
  });
});

it("rejects partial directory response before rendering and preserves nullable stats", async () => {
  const { directoryResponse } = await import(
    "../../src/contracts/player-directory"
  );
  expect(directoryResponse.safeParse({ players: [] }).success).toBe(false);
  const payload = {
    players: [
      {
        id: "demo",
        name: "DEMO",
        role: "hitter",
        teams: [],
        games: 0,
        ops: null,
        era: null,
        score: null,
        confidence: null,
        lastAppearance: null,
        source: "DEMO fixture",
        registration: {
          status: "unknown",
          snapshotId: null,
          asOf: null,
          sourceId: null,
        },
      },
    ],
    total: 1,
    page: 1,
    pages: 1,
    asOf: "2026-10-31",
    updatedAt: "2026-11-01",
    source: "DEMO fixture",
    season: 2026,
  };
  expect(directoryResponse.parse(payload).players[0].ops).toBeNull();
  expect(
    directoryResponse.safeParse({
      ...payload,
      players: [{ ...payload.players[0], games: -1 }],
    }).success,
  ).toBe(false);
});

it("reaggregates traded doubleheaders before windowing, preserving full-population scores and cache scopes", () => {
  const f = structuredClone(fixture);
  const p = f.players.find((p) => p.playerId === "demo_0_10")!;
  const template = f.games.find((g) =>
    g.pitching.some((l) => l.playerId === p.playerId),
  )!;
  const line = template.pitching.find((l) => l.playerId === p.playerId)!;
  f.games = Array.from({ length: 4 }, (_, i) => ({
    ...structuredClone(template),
    gameId: `transfer_${i}`,
    date: "2026-10-15",
    doubleheaderNo: i + 1,
    batting: [],
    pitching: [
      {
        ...line,
        role: "STARTER",
        teamId: i < 2 ? "sample_0" : "sample_1",
        outsRecorded: 9,
        er: i,
      },
    ],
  }));
  const read = (team = "", window = "20") =>
    selectDirectory(f, directoryQuery.parse({ team, window, q: p.displayName }))
      .players[0];
  const all = read();
  const before = read("sample_0");
  const after = read("sample_1");
  expect(all.games).toBe(before.games + after.games);
  expect(all.era).toBe((before.era! + after.era!) / 2);
  expect(before.era).toBe(1.5);
  expect(after.era).toBe(7.5);
  expect(read("", "3").era).toBe(6);
  expect(read("sample_0", "3").games).toBe(2);
  expect(read("sample_9")).toBeUndefined();
  expect(read()).toEqual(all);
  const otherSeason = { ...f, season: 2025 };
  expect(selectDirectory(otherSeason, directoryQuery.parse({})).total).toBe(0);
  expect(
    selectDirectory(
      { ...f, competition: "postseason" },
      directoryQuery.parse({}),
    ).total,
  ).toBe(0);
});

it("counts role changes separately and never fills absent batting fields", () => {
  const f = structuredClone(fixture);
  const p = f.players.find((p) => p.playerId === "demo_0_12")!;
  const result = selectDirectory(
    f,
    directoryQuery.parse({ q: p.displayName, window: "20" }),
  ).players[0];
  const starts = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) => g.pitching)
    .filter((l) => l.playerId === p.playerId && l.role === "STARTER");
  expect(result.games).toBe(Math.min(20, starts.length));
  const traded = selectDirectory(
    f,
    directoryQuery.parse({ q: "가상 A-01", team: "sample_0" }),
  ).players[0];
  expect(traded.ops).toBeNull();
  expect(traded.lastAppearance! < "2026-10-16").toBe(true);
});

it("weights team ERA by outs and keeps independent recent windows distinct", () => {
  const f = structuredClone(fixture);
  const p = f.players.find((p) => p.playerId === "demo_0_10")!;
  const template = f.games.find((g) =>
    g.pitching.some((l) => l.playerId === p.playerId),
  )!;
  const line = template.pitching.find((l) => l.playerId === p.playerId)!;
  f.games = Array.from({ length: 4 }, (_, i) => ({
    ...structuredClone(template),
    gameId: `weighted_${i}`,
    date: "2026-10-15",
    doubleheaderNo: i + 1,
    batting: [],
    pitching: [
      {
        ...line,
        role: "STARTER",
        teamId: i < 2 ? "sample_0" : "sample_1",
        outsRecorded: i < 2 ? 3 : 9,
        er: 1,
      },
    ],
  }));
  const read = (team: string, window = "20") =>
    selectDirectory(f, directoryQuery.parse({ team, window, q: p.displayName }))
      .players[0];
  const all = read("");
  const old = read("sample_0");
  const current = read("sample_1");
  expect(all.games).toBe(old.games + current.games);
  expect(all.era).toBe((old.era! * 6 + current.era! * 18) / 24);
  expect(all.era).not.toBe((old.era! + current.era!) / 2);
  expect(read("", "3").games).toBe(3);
  expect(read("sample_0", "3").games + read("sample_1", "3").games).toBe(4);
  expect(read("")).toEqual(all);
});

it("does not infer registration from appearances and rejects unsupported membership/scope", () => {
  const result = selectDirectory(generate(), directoryQuery.parse({}));
  expect(result.players.length).toBeGreaterThan(0);
  expect(
    result.players.every(
      (p) =>
        p.games > 0 &&
        p.registration.status === "unknown" &&
        p.registration.snapshotId === null &&
        p.registration.asOf === null &&
        p.registration.sourceId === null,
    ),
  ).toBe(true);
  expect(directoryQuery.safeParse({ membership: "current" }).success).toBe(
    false,
  );
  expect(directoryQuery.safeParse({ season: "2025" }).success).toBe(false);
  expect(directoryQuery.safeParse({ competition: "postseason" }).success).toBe(
    false,
  );
});

it("partitions sample filters before pagination and preserves deterministic ties", () => {
  const f = generate();
  const read = (sample = "", page = "1") =>
    selectDirectory(
      f,
      directoryQuery.parse({ sample, page, window: "10", sort: "score" }),
    );
  const all = read();
  const complete = read("complete");
  const short = read("short");
  expect(complete.total + short.total).toBe(all.total);
  expect(complete.players.every((p) => p.games === 10)).toBe(true);
  expect(short.players.every((p) => p.games < 10)).toBe(true);
  expect(read("unscored").total).toBe(all.total);
  const ids = Array.from({ length: all.pages }, (_, i) =>
    read("", String(i + 1)).players.map((p) => p.id),
  ).flat();
  expect(new Set(ids).size).toBe(all.total);
  expect(read().players).toEqual(all.players);
  expect(directoryQuery.safeParse({ sample: "invented" }).success).toBe(false);
});
