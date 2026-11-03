import { expect, it, vi } from "vitest";
import { boardQuery } from "../../src/contracts/ranking-boards";
import { selectRankingBoards } from "../../src/server/reads/ranking-boards";
import {
  momentumView,
  modelVersion,
  type MomentumSnapshot,
} from "../../src/server/reads/momentum";
import { GET } from "../../src/app/api/v1/rankings/route";
import { pipeline } from "../../src/server/ingest/pipeline";
import { momentumResponse } from "../../src/contracts/momentum";
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
it("orders raw values before pagination even when displayed values coincide", () => {
  const rows = Array.from({ length: 25 }, (_, i) =>
    snapshot(`id${String(i).padStart(2, "0")}`, { score: 60.01 + i * 0.001 }),
  );
  const result = selectRankingBoards(state(rows), { ...q, page: 2 });
  expect(result.boards[0].total).toBe(25);
  expect(result.boards[0].rows.map((s) => s.id)).toEqual([
    "id04",
    "id03",
    "id02",
    "id01",
    "id00",
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

for (const sort of ["score", "change", "decline"] as const) {
  it(`keeps exact competition ties across pages and API/URL for ${sort}`, async () => {
    const sign = sort === "decline" ? -1 : 1;
    const rows = Array.from({ length: 23 }, (_, i) =>
      snapshot(`p${String(i).padStart(2, "0")}`, {
        score: i < 19 ? 80 + (19 - i) : i < 22 ? 60.02 : 60.01,
        deltaScore: sign * (i < 19 ? 20 + (19 - i) : i < 22 ? 0.02 : 0.01),
      }),
    );
    const input = state(rows);
    input.momentumCurrent = rows.map((s) => s.id);
    const query = boardQuery.parse(
      Object.fromEntries(
        new URLSearchParams(`date=2026-10-21&sort=${sort}&page=2`),
      ),
    );
    const board = selectRankingBoards(input, query).boards[0];
    expect(board.rows.map((s) => s.rank)).toEqual([20, 20, 23]);
    expect(
      selectRankingBoards(input, { ...query, page: 1 }).boards[0].rows[19].rank,
    ).toBe(20);
    const api = momentumView(input, { ...query, window: 10, role: "hitter" });
    expect(
      api.data.map((s) => [
        s.id,
        "rank" in s ? s.rank : undefined,
        s.score,
        s.deltaScore,
      ]),
    ).toEqual(board.rows.map((s) => [s.id, s.rank, s.score, s.deltaScore]));
    expect(board.rows[0].score).toBe(60.02);
    const read = vi.spyOn(pipeline, "readPublicState").mockResolvedValue(input);
    try {
      const response = await GET(
        new Request(
          `http://localhost/api/v1/rankings?role=hitter&season=2026&window=10&date=2026-10-21&sort=${sort}&page=2`,
        ),
      );
      expect(response.status).toBe(200);
      const body = momentumResponse.parse(await response.json());
      expect(
        body.data.map((s) => [s.id, s.rank, s.score, s.deltaScore]),
      ).toEqual(board.rows.map((s) => [s.id, s.rank, s.score, s.deltaScore]));
    } finally {
      read.mockRestore();
    }
  });
}
it("filters nulls, zero changes, low confidence and insufficient samples using raw signs", () => {
  const input = state([
    snapshot("null-score", { score: null, deltaScore: 3 }),
    snapshot("low", { confidence: "low" }),
    snapshot("small", { sampleSize: 1 }),
    snapshot("null-delta"),
    snapshot("zero", { deltaScore: 0 }),
    snapshot("tiny-up", { deltaScore: 0.001 }),
    snapshot("tiny-down", { deltaScore: -0.001 }),
  ]);
  expect(selectRankingBoards(input, q).boards[0].excluded).toBe(3);
  expect(
    selectRankingBoards(input, { ...q, sort: "change" }).boards[0].rows.map(
      (s) => s.id,
    ),
  ).toEqual(["tiny-up"]);
  expect(
    selectRankingBoards(input, { ...q, sort: "decline" }).boards[0].rows.map(
      (s) => s.id,
    ),
  ).toEqual(["tiny-down"]);
  expect(selectRankingBoards(input, q).boards[0].noPrevious).toBe(1);
});

it("filters transfer membership without changing published global features or eligibility", async () => {
  const { rowKey } = await import("../../src/server/ingest/files");
  const s = state([]);
  const refs: string[] = [];
  for (const [i, team] of ["old", "new"].entries()) {
    const record: PipelineState["records"][string] = {
      kind: "batting_game_logs",
      row: {
        season: 2026,
        competition: "regular",
        game_id: `dh_${i}`,
        external_player_id: "transfer",
        player_id: "transfer",
        team_id: team,
      },
      batchId: "demo",
      sourceId: "demo",
      licenseId: "demo",
    };
    s.records[String(i)] = record;
    refs.push(
      JSON.stringify([
        rowKey(record.kind, record.row),
        record.batchId,
        record.licenseId,
      ]),
    );
  }
  const snap = snapshot("transfer", { inputRefs: refs });
  s.momentumSnapshots = { transfer: snap };
  const global = selectRankingBoards(s, q).boards[0].rows[0];
  for (const team of ["old", "new"]) {
    const filtered = selectRankingBoards(s, { ...q, team }).boards[0].rows[0];
    expect(filtered).toEqual(global);
    expect(filtered.score).toBe(snap.score);
    expect(filtered.rawFeatureSummary).toEqual(snap.rawFeatureSummary);
  }
  expect(selectRankingBoards(s, { ...q, team: "none" }).boards[0].rows).toEqual(
    [],
  );
});

it("uses doubleheader order rather than lexical game IDs for recent membership", async () => {
  const { rowKey } = await import("../../src/server/ingest/files");
  const input = state([]);
  const refs: string[] = [];
  for (const [gameId, order, team] of [
    ["z_first", 1, "old"],
    ["a_second", 2, "new"],
  ] as const) {
    for (const record of [
      {
        kind: "games" as const,
        row: {
          game_id: gameId,
          played_on: "2026-10-21",
          doubleheader_no: order,
        },
      },
      {
        kind: "batting_game_logs" as const,
        row: { game_id: gameId, player_id: "transfer", team_id: team },
      },
    ]) {
      const stored: PipelineState["records"][string] = {
        ...record,
        batchId: "demo",
        sourceId: "demo",
        licenseId: "demo",
      };
      input.records[`${record.kind}/${gameId}`] = stored;
      refs.push(
        JSON.stringify([rowKey(stored.kind, stored.row), "demo", "demo"]),
      );
    }
  }
  input.momentumSnapshots = {
    transfer: snapshot("transfer", { inputRefs: refs, sampleSize: 1 }),
  };
  // Insufficient samples stay excluded, but their membership still reflects W.
  const board = selectRankingBoards(input, q);
  expect(board.teams).toEqual(["new"]);
  expect(
    selectRankingBoards(input, { ...q, team: "old" }).boards[0].excluded,
  ).toBe(0);
  expect(
    selectRankingBoards(input, { ...q, team: "new" }).boards[0].excluded,
  ).toBe(1);
});
