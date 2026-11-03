import { expect, it } from "vitest";
import { boardQuery } from "../../src/contracts/ranking-boards";
import { selectRankingBoards } from "../../src/server/reads/ranking-boards";
import {
  modelVersion,
  type MomentumSnapshot,
} from "../../src/server/reads/momentum";
import type { PipelineState } from "../../src/server/ingest/pipeline";
const q = boardQuery.parse({ date: "2026-10-21" });
function snapshot(
  id: string,
  patch: Partial<MomentumSnapshot> = {},
): MomentumSnapshot {
  return {
    id,
    playerId: id,
    role: "hitter",
    season: 2026,
    competition: "regular",
    modelVersion,
    algorithmVersion: modelVersion,
    computedAt: "2026-10-21T13:00:00Z",
    asOf: "2026-10-21T13:00:00Z",
    dataAsOfGameId: null,
    window: 10,
    windowBasis: "最近",
    rawFeatureSummary: {
      W: {
        appearances: 10,
        opportunities: 40,
        outs: null,
        metrics: { OBP: { value: 0.4 } },
      },
    },
    score: 60,
    confidence: "medium",
    eligibility: { eligible: true, reason: null },
    explanation: {},
    deltaScore: null,
    previousSnapshotId: null,
    sourceIds: ["demo"],
    inputRefs: [],
    sampleSize: 10,
    demo: true,
    publicationRevision: 1,
    rankingStatus: "ranked",
    ...patch,
  };
}
function state(s: MomentumSnapshot[]): PipelineState {
  return {
    version: 1,
    revision: 1,
    batches: {},
    records: {},
    history: [],
    audit: [],
    events: [],
    aggregates: {},
    scores: {},
    momentumSnapshots: Object.fromEntries(s.map((x) => [x.id, x])),
  };
}
it("excludes a 90-point one-game player even if upstream eligibility says ranked", () => {
  const result = selectRankingBoards(
    state([snapshot("small", { score: 90, sampleSize: 1 }), snapshot("valid")]),
    q,
  );
  expect(result.boards[0].rows.map((s) => s.id)).toEqual(["valid"]);
  expect(result.boards[0].excluded).toBe(1);
});
it("orders the displayed values on the server with stable ties and pagination", () => {
  const rows = Array.from({ length: 25 }, (_, i) =>
    snapshot(`id${String(i).padStart(2, "0")}`, { score: 60.01 + i * 0.001 }),
  );
  const result = selectRankingBoards(state(rows), { ...q, page: 2 });
  expect(result.boards[0].total).toBe(25);
  expect(result.boards[0].rows.map((s) => s.id)).toEqual([
    "id20",
    "id21",
    "id22",
    "id23",
    "id24",
  ]);
  expect(result.boards[0].rows[0].rank).toBe(21);
});
it("does not manufacture snapshots for a missing date or mix scoring versions", () => {
  expect(
    selectRankingBoards(state([snapshot("a")]), { ...q, date: "2026-10-22" })
      .stale,
  ).toBe(true);
  const mixed = selectRankingBoards(
    state([snapshot("a"), snapshot("b", { algorithmVersion: "future" })]),
    q,
  );
  expect(mixed.stale).toBe(true);
  expect(mixed.boards[0].rows).toHaveLength(0);
});
it("keeps roles separate and separates increases, declines and missing comparisons", () => {
  const s = state([
    snapshot("up", { deltaScore: 2 }),
    snapshot("down", { deltaScore: -3 }),
    snapshot("none"),
    snapshot("pitcher", { role: "starter" }),
  ]);
  expect(
    selectRankingBoards(s, { ...q, sort: "change" }).boards[0].rows.map(
      (s) => s.id,
    ),
  ).toEqual(["up"]);
  expect(
    selectRankingBoards(s, { ...q, sort: "decline" }).boards[0].rows.map(
      (s) => s.id,
    ),
  ).toEqual(["down"]);
  expect(selectRankingBoards(s, q).boards[0].noPrevious).toBe(1);
  expect(
    selectRankingBoards(s, { ...q, team: "missing" }).boards[0].total,
  ).toBe(0);
});
it("validates shareable URL conditions", () => {
  for (const input of [
    { page: 0 },
    { date: "2026-02-30" },
    { sort: "unknown" },
    { window: "7" },
    { season: 2026.5 },
  ])
    expect(boardQuery.safeParse(input).success).toBe(false);
  expect(boardQuery.parse({ team: "" }).team).toBeUndefined();
});
it("uses the atomic current manifest even when immutable IDs retain older revisions", () => {
  const s = state([
    snapshot("unchanged", { publicationRevision: 1 }),
    snapshot("corrected", { publicationRevision: 2 }),
    snapshot("obsolete", { publicationRevision: 2, score: 99 }),
  ]);
  s.momentumCurrent = ["unchanged", "corrected"];
  expect(selectRankingBoards(s, q).boards[0].rows.map((r) => r.id)).toEqual([
    "corrected",
    "unchanged",
  ]);
});
