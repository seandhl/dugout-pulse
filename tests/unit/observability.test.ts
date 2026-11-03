import { describe, it, expect, vi } from "vitest";
import { inspect, dispatch } from "../../src/server/observability/rules";
import {
  requestMetrics,
  observeJob,
  observeRequest,
} from "../../src/server/observability/runtime";
import type { PipelineState } from "../../src/server/ingest/pipeline";
import type { MomentumSnapshot } from "../../src/server/reads/momentum";
function fixture(): PipelineState {
  const row = {
    season: 2026,
    competition: "regular",
    as_of: "2026-01-01T00:00:00Z",
    played_on: "2026-01-01",
    game_id: "demo_g",
    home_team_id: "demo_a",
    away_team_id: "demo_b",
    status: "FINAL",
    h: 5,
    ab: 3,
    doubles: 4,
    triples: 1,
    hr: 1,
    bb: -1,
    bf: 1,
    outs: 3,
  };
  return {
    version: 1,
    revision: 2,
    audit: [],
    batches: {},
    records: Object.fromEntries(
      ["a", "b"].map((key) => [
        key,
        {
          kind: "games",
          row,
          sourceId: "",
          licenseId: "demo",
          batchId: "demo",
        },
      ]),
    ),
    history: [],
    events: [],
    aggregates: {},
    scores: {},
  };
}
describe("운영 실패 fixture", () => {
  it("낡은 기록과 모든 기록 불변식 실패를 재현하고 adapter에 보낸다", async () => {
    const report = inspect(fixture(), Date.parse("2026-11-03T00:00:00Z"));
    const codes = report.alerts.map((a) => a.code);
    for (const code of [
      "DATASET_STALE",
      "H_GT_AB",
      "EXTRA_BASE_GT_H",
      "NEGATIVE_RECORD",
      "BF_OUTS_REVIEW",
      "MISSING_SOURCE",
      "DUPLICATE_GAME",
    ])
      expect(codes).toContain(code);
    expect(report.datasets[0].seasonCompleteness).toBeNull();
    const emit = vi.fn();
    await dispatch(report.alerts, { emit });
    expect(emit).toHaveBeenCalledTimes(report.alerts.length);
  });
  it("동일 scope baseline 대비 극단·미계산·분포·역할·NaN 경고", () => {
    const state = fixture();
    state.momentumSnapshots = {};
    state.momentumCurrent = [];
    for (let i = 0; i < 40; i++)
      for (const revision of [1, 2]) {
        const id = `${revision}-${i}`;
        state.momentumSnapshots[id] = {
          id,
          season: 2026,
          competition: "regular",
          role: "hitter",
          window: 10,
          algorithmVersion: "v1",
          publicationRevision: revision,
          score: revision === 1 ? 50 : i < 20 ? null : 100,
          windowBasis:
            revision === 1 ? "최근 타격 출전 경기" : "최근 선발 등판",
        } as MomentumSnapshot;
        if (revision === 2) state.momentumCurrent.push(id);
      }
    state.momentumSnapshots["2-39"].score = NaN;
    const codes = inspect(state).alerts.map((a) => a.code);
    for (const code of [
      "SCORE_NONFINITE",
      "ROLE_MIX",
      "SCORE_EXTREME_SURGE",
      "SCORE_UNCALCULATED_SURGE",
      "SCORE_DISTRIBUTION_SHIFT",
    ])
      expect(codes).toContain(code);
    state.momentumCurrent = ["2-39"];
    expect(inspect(state).scores[0].comparisonAvailable).toBe(false);
  });
  it("계산 scope 역할 혼합과 관리자 접근 차단", async () => {
    const state = fixture();
    state.momentumCurrent = ["mixed"];
    state.momentumSnapshots = {
      mixed: {
        id: "mixed",
        season: 2026,
        competition: "regular",
        role: "hitter",
        window: 10,
        algorithmVersion: "v1",
        publicationRevision: 2,
        score: 50,
        windowBasis: "최근 타격 출전 경기",
        explanation: {
          calculation: { explanation: { scope: { role: "starting_pitcher" } } },
        },
      } as MomentumSnapshot,
    };
    expect(inspect(state).alerts.map((a) => a.code)).toContain("ROLE_MIX");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { GET, POST } = await import(
        "../../src/app/api/admin/operations/route"
      );
      for (const handler of [GET, POST]) {
        const response = await handler(
          new Request("http://untrusted.invalid/api/admin/operations"),
        );
        expect(response.status).toBe(403);
        expect(await response.text()).not.toContain("datasets");
      }
    } finally {
      spy.mockRestore();
    }
  });
  it("P50/P95·5xx·job 실패와 빈 표본", () => {
    const at = new Date().toISOString();
    const m = requestMetrics([
      ...Array.from({ length: 20 }, (_, i) => ({
        type: "request" as const,
        at,
        status: i === 0 ? 500 : 200,
        durationMs: i + 1,
      })),
      { type: "job", at, ok: false },
    ]);
    expect(m).toMatchObject({
      p50Ms: 10,
      p95Ms: 19,
      apiErrorRate: 0.05,
      scheduledJobFailures: 1,
    });
    expect(requestMetrics([]).p95Ms).toBeNull();
  });
  it("원본 예외·비밀 값을 로깅하지 않고 실패를 보존", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await expect(
        observeJob(async () => {
          throw new Error("SECRET upload private-person");
        }),
      ).rejects.toThrow("SECRET");
      await observeRequest(async () => new Response("SECRET", { status: 503 }));
      expect(spy.mock.calls.map((c) => c.join(" ")).join()).not.toMatch(
        /SECRET|private-person|upload/,
      );
      expect(spy.mock.calls.map((c) => c.join(" ")).join()).toContain(
        '"ok":false',
      );
    } finally {
      spy.mockRestore();
    }
  });
});
