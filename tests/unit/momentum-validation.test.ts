import { describe, expect, it } from "vitest";
import { fixture, momentumScenario } from "../../fixtures/stats/momentum-input";
import { MODEL, scoreMomentum } from "../../src/stats/momentum";
import {
  atCutoff,
  assertScoringVersion,
  evaluate,
  actualBacktestGate,
  rankingVolatility,
} from "../../src/stats/momentum-validation";

describe("offline validation", () => {
  it("rejects mixed, absent, unsupported versions and length mismatch", () => {
    for (const v of [[], [MODEL, "old"], ["old"]])
      expect(() => assertScoringVersion(v)).toThrow();
    expect(() => evaluate([fixture()], [MODEL, MODEL])).toThrow();
  });
  it("future results and later revisions cannot alter features or baseline", () => {
    const f = momentumScenario("hitter", "up");
    const expected = scoreMomentum(atCutoff(f, f.cutoffAt));
    for (const playerId of ["target", "cohort0"]) {
      const row = f.rows.find((r) => r.playerId === playerId)!;
      const future = {
        ...row,
        gameId: "future",
        completedAt: "2026-10-22T12:00:00Z",
        asOf: "2026-10-22T13:00:00Z",
        counts: { ...row.counts, h: 4, so: 0 },
      };
      const correction = {
        ...row,
        revision: 2,
        asOf: "2026-10-22T13:00:00Z",
        counts: { ...row.counts, h: 4, so: 0 },
      };
      expect(
        scoreMomentum(
          atCutoff({ ...f, rows: [...f.rows, future, correction] }, f.cutoffAt),
        ),
      ).toEqual(expected);
    }
  });
  it("includes records at completion only if already published", () => {
    const f = fixture(),
      cutoff = "2026-10-21T12:00:00Z";
    f.roster.asOf = "2026-10-20T00:00:00Z";
    expect(atCutoff(f, cutoff).rows).toHaveLength(0);
    f.rows = f.rows.map((r) => ({ ...r, asOf: cutoff }));
    expect(atCutoff(f, cutoff).rows).toHaveLength(f.rows.length);
    f.roster.asOf = "2026-10-22T00:00:00Z";
    expect(() => atCutoff(f, cutoff)).toThrow("Future roster");
  });
  it.each(["hitter", "starting_pitcher", "relief_pitcher"] as const)(
    "sensitivity %s reproduces defaults and contracts toward 50",
    (role) => {
      const [r] = evaluate([momentumScenario(role, "up")], [MODEL]);
      if (!r.sensitivity) throw Error("Expected score");
      const select = (tau: number) =>
        r.sensitivity.find(
          (s) =>
            s.tauMultiplier === tau &&
            s.temperature === 1 &&
            s.firstFeatureWeightMultiplier === 1,
        )!;
      expect(select(1).score).toBeCloseTo(r.score!, 12);
      expect(Math.abs(select(2).score - 50)).toBeLessThan(
        Math.abs(select(0.5).score - 50),
      );
      expect(r.sensitivity).toHaveLength(27);
      expect(
        r.sensitivity.every(
          (s) => Number.isFinite(s.score) && s.score > 0 && s.score < 100,
        ),
      ).toBe(true);
      expect(Math.abs(r.score! - 50)).toBeLessThan(
        Math.abs(r.unshrunkScore! - 50),
      );
      expect(evaluate([fixture(role)], [MODEL])[0].score).toBe(50);
    },
  );
  it("withholds tiny samples rather than expressing confidence", () => {
    const [r] = evaluate([momentumScenario("hitter", "sample")], [MODEL]);
    expect(r.score).toBeNull();
    expect(r.status).toBe("insufficient_sample");
  });
  it("rights and coverage gates fail closed, including approved manifest without adapter", () => {
    expect(() => actualBacktestGate({})).toThrow("rights");
    expect(() =>
      actualBacktestGate({ rightsApproved: true, rightsEvidence: "contract" }),
    ).toThrow("historical");
    expect(() =>
      actualBacktestGate({
        rightsApproved: true,
        rightsEvidence: "contract",
        coverageComplete: true,
        completedGames: 100,
      }),
    ).toThrow("adapter not implemented");
  });
  it("measures rank movement, average ties, entries and exits", () => {
    const a = [
      { playerId: "a", score: 60 },
      { playerId: "b", score: 50 },
    ];
    const b = [
      { playerId: "a", score: 50 },
      { playerId: "b", score: 60 },
      { playerId: "c", score: 40 },
    ];
    expect(rankingVolatility(a, b)).toMatchObject({
      commonPlayers: 2,
      entered: 1,
      exited: 0,
      absoluteRankChange: { mean: 1 },
    });
    expect(
      rankingVolatility(a, [
        { playerId: "a", score: 50 },
        { playerId: "b", score: 50 },
      ]).absoluteRankChange.mean,
    ).toBe(0.5);
  });
});
