import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { MomentumSnapshot } from "../../src/server/reads/momentum";
import { modelVersion } from "../../src/server/reads/momentum-version";

const context = vi.hoisted(() => ({
  query: "",
  state: {} as Record<string, unknown>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(context.query),
  useRouter: () => ({}),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../src/server/repositories/page-publication", () => ({
  withPagePublication: (fn: () => unknown) => fn(),
  withoutReleaseQuery: (params: unknown) => params,
}));
vi.mock("../../src/server/repositories/publication", () => ({
  publicationIdentity: () => ({ releaseId: "synthetic_v2" }),
}));
vi.mock("../../src/server/ingest/pipeline", () => ({
  pipeline: { readPublicState: async () => context.state },
}));
// No database writes or live publication: route rendering uses an isolated test snapshot.
vi.mock("../../src/server/composition", () => ({ playersService: {} }));
import DetailPage from "../../src/app/(public)/players/[id]/page";
import RankingsPage from "../../src/app/(public)/rankings/page";

function fixture(): MomentumSnapshot {
  return {
    id: "test_snapshot",
    playerId: "demo_0_00",
    role: "hitter",
    season: 2026,
    competition: "regular",
    modelVersion,
    algorithmVersion: modelVersion,
    computedAt: "2026-10-21T13:00:00Z",
    asOf: "2026-10-21T13:00:00Z",
    dataAsOfGameId: null,
    window: 10,
    windowBasis: "recent appearances",
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
    sourceIds: ["demo-test-fixture"],
    inputRefs: ["demo-test-fixture/game-1"],
    sampleSize: 10,
    demo: true,
    publicationRevision: 1,
    rankingStatus: "ranked",
  };
}
function setup() {
  const s = fixture();
  context.state = {
    version: 1,
    revision: 1,
    batches: {},
    records: {},
    history: [],
    audit: [],
    events: [],
    aggregates: {},
    scores: {},
    momentumSnapshots: { [s.id]: s },
  };
  return s;
}
it("renders populated ranking identity with avatar and the exact snapshot detail destination", async () => {
  setup();
  context.query = "";
  const page = await RankingsPage({
    searchParams: Promise.resolve({ date: "2026-10-21" }),
  });
  const html = renderToStaticMarkup(page);
  expect(html).toContain('class="ranking-player-cell"');
  expect(html).toContain('class="ranking-player-link"');
  expect(html).toContain("중립 플레이스홀더");
  expect(html).toContain("snapshot=test_snapshot");
  expect(html).toContain("포지션 미제공");
  expect(html).toContain("60.0");
});
it("snapshot tabs retain snapshot provenance and expose missing season records without substituting live stats", async () => {
  const s = setup();
  context.query = "tab=season";
  const page = await DetailPage({
    params: Promise.resolve({ id: s.playerId }),
    searchParams: Promise.resolve({ snapshot: s.id, tab: "season" }),
  });
  const html = renderToStaticMarkup(createElement("main", null, page));
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain("시즌 전체 일반 기록이 연결되어");
  expect(html).toContain("demo-test-fixture");
  expect(html).not.toContain("AVG · 타율");
  expect(html).toContain("60.0");
  context.query = "tab=momentum";
  const analysis = renderToStaticMarkup(
    await DetailPage({
      params: Promise.resolve({ id: s.playerId }),
      searchParams: Promise.resolve({ snapshot: s.id }),
    }),
  );
  expect(analysis).toContain("demo-test-fixture/game-1");
});
it("rejects a snapshot bound to another player", async () => {
  const s = setup();
  await expect(
    DetailPage({
      params: Promise.resolve({ id: "demo_0_01" }),
      searchParams: Promise.resolve({ snapshot: s.id }),
    }),
  ).rejects.toThrow("NOT_FOUND");
});
