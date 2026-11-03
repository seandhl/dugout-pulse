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
