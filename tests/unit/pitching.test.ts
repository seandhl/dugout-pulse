import { describe, expect, it } from "vitest";
import {
  comparePitching,
  formatInnings,
  pitchingStats,
  type PitchingAppearance,
  type PitchingCounts,
  type PitchingRow,
} from "../../src/stats/pitching";
const row = (counts: PitchingCounts): PitchingRow => ({
  counts,
  walkDefinition: "includes_ibb",
});
const scope = {
  playerId: "demo-p",
  season: 2026,
  competition: "regular" as const,
};
const appearance = (
  i: number,
  role: PitchingAppearance["role"] = "STARTER",
): PitchingAppearance => ({
  ...scope,
  ...row({
    outsRecorded: 3,
    er: 1,
    r: 1,
    h: 1,
    hr: 0,
    so: 1,
    bb: 0,
    ibb: 0,
    hbp: 0,
    bf: 4,
    sv: 0,
    hld: 0,
  }),
  gameId: `g${i}`,
  playedOn: `2026-10-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
  order: (i % 2) + 1,
  role,
  sourceId: "DEMO",
  asOf: "2026-11-03T00:00:00Z",
  inputRef: `fixture:${i}`,
});
describe("pitching raw-count formulas", () => {
  it.each([
    [0, "0.0"],
    [1, "0.1"],
    [2, "0.2"],
    [17, "5.2"],
    [27, "9.0"],
  ])("formats %i actual outs as %s", (outs, display) => {
    expect(formatInnings(outs)).toBe(display);
  });
  it("uses 17/3 IP, calculates all rates without rounding or averaging", () => {
    const result = pitchingStats([
      row({
        outsRecorded: 17,
        er: 2,
        r: 3,
        h: 5,
        hr: 1,
        so: 7,
        bb: 2,
        ibb: 1,
        hbp: 1,
        bf: 24,
        sv: 0,
        hld: 0,
      }),
    ]);
    expect(result.ip).toBe(17 / 3);
    const expected = {
      era: 54 / 17,
      whip: 21 / 17,
      kPer9: 189 / 17,
      bbPer9: 54 / 17,
      hrPer9: 27 / 17,
      kPct: 7 / 24,
      bbPct: 2 / 24,
      kMinusBbPct: 5 / 24,
    };
    for (const [key, value] of Object.entries(expected))
      expect(result.metrics[key as keyof typeof expected].value).toBeCloseTo(
        value,
        12,
      );
    expect(
      pitchingStats([
        row({ outsRecorded: 3, er: 1 }),
        row({ outsRecorded: 27, er: 0 }),
      ]).metrics.era.value,
    ).toBeCloseTo(0.9);
    expect(result.metrics.fip.value).toBeNull();
  });
  it("normalizes source BB definitions per appearance, without double counting IBB", () => {
    const inclusive = row({ outsRecorded: 3, bb: 2, ibb: 1, h: 0, bf: 4 });
    const exclusive: PitchingRow = {
      counts: { outsRecorded: 3, bb: 1, ibb: 1, h: 0, bf: 4 },
      walkDefinition: "excludes_ibb",
    };
    expect(pitchingStats([inclusive]).metrics.whip.value).toBe(2);
    expect(pitchingStats([inclusive, exclusive]).totals.bb).toBe(4);
    expect(
      pitchingStats([{ ...exclusive, counts: { bb: 1 } }]).totals.bb,
    ).toBeNull();
    expect(pitchingStats([row({ bb: 1 })]).totals.bb).toBe(1);
  });
  it("keeps zero-out runs/walks and returns N/A per IP, still calculating BF rates", () => {
    const result = pitchingStats([
      row({ outsRecorded: 0, er: 2, r: 2, h: 1, bb: 1, so: 0, bf: 2 }),
    ]);
    for (const key of ["era", "whip", "kPer9", "bbPer9", "hrPer9"] as const)
      expect(result.metrics[key].value).toBeNull();
    expect(result.metrics.era.reason).toBe("zero_denominator");
    expect(result.metrics.bbPct.value).toBe(0.5);
    expect(
      pitchingStats([
        row({ outsRecorded: 0, er: 2 }),
        row({ outsRecorded: 3, er: 0 }),
      ]).metrics.era.value,
    ).toBe(18);
  });
  it("propagates missing counts and handles zero BF and negative K-BB%", () => {
    expect(pitchingStats([]).sample.appearances).toBe(0);
    expect(formatInnings(null)).toBe("N/A");
    expect(pitchingStats([row({ so: 2 })]).metrics.kPct.reason).toBe(
      "missing_fields",
    );
    expect(pitchingStats([row({ bf: 0, so: 0 })]).metrics.kPct.reason).toBe(
      "zero_denominator",
    );
    expect(
      pitchingStats([row({ bf: 3, so: 0, bb: 2 })]).metrics.kMinusBbPct.value,
    ).toBeCloseTo(-2 / 3);
    expect(pitchingStats([row({ h: 1 }), row({})]).totals.h).toBeNull();
  });
  it("rejects invalid counts and inconsistent component records", () => {
    for (const counts of [
      { outsRecorded: 5.2 },
      { bb: -1 },
      { so: NaN },
      { h: Infinity },
      { er: 2, r: 1 },
      { hr: 2, h: 1 },
      { bb: 1, ibb: 2 },
      { sv: 2 },
      { sv: 1, hld: 1 },
      { bf: 1, bb: 2 },
    ])
      expect(() => pitchingStats([row(counts)])).toThrow();
    expect(() =>
      pitchingStats([row({ h: Number.MAX_SAFE_INTEGER }), row({ h: 1 })]),
    ).toThrow("Unsafe");
    expect(() => formatInnings(-1)).toThrow();
  });
});
describe("role-specific pitching aggregation", () => {
  it("separates 3/5 starts and 5/10 relief appearances after filtering scope", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      appearance(i, i % 2 ? "RELIEVER" : "STARTER"),
    );
    const input = rows.map((r) => Object.freeze(r)).reverse();
    const result = comparePitching(input, scope);
    for (const [series, windows] of [
      [result.starter, [3, 5]],
      [result.reliever, [5, 10]],
    ] as const) {
      expect(series.season.g).toBe(15);
      for (const n of windows) {
        expect(series.recent[n].g).toBe(n);
        expect(series.recent[n].totals.outsRecorded).toBe(3 * n);
        expect(series.recent[n].windowComplete).toBe(true);
      }
    }
    expect(result.starter.season.gs).toBe(15);
    expect(result.reliever.season.gs).toBe(0);
    expect(result.starter.recent[3].provenance[0].gameId).toBe("g28");
    expect(input[0].gameId).toBe("g29");
  });
  it("counts doubleheaders separately in order, preserving role and provenance", () => {
    const result = comparePitching(
      [appearance(0), appearance(1)],
      scope,
    ).starter;
    expect(result.season.g).toBe(2);
    expect(result.recent[3].windowComplete).toBe(false);
    expect(result.recent[3].provenance.map((r) => r.gameId)).toEqual([
      "g1",
      "g0",
    ]);
    expect(result.season.provenance[0]).toMatchObject({
      sourceId: "DEMO",
      inputRef: "fixture:1",
      role: "STARTER",
      asOf: "2026-11-03T00:00:00Z",
    });
  });
  it("excludes other seasons, competitions and players including identical game IDs", () => {
    const rows = [
      appearance(0),
      { ...appearance(0), season: 2025 },
      { ...appearance(0), competition: "postseason" as const },
      { ...appearance(0), playerId: "other" },
    ];
    expect(comparePitching(rows, scope).starter.season.g).toBe(1);
    expect(comparePitching([], scope).reliever.season.g).toBe(0);
    expect(() =>
      comparePitching([appearance(0), appearance(0)], scope),
    ).toThrow("Duplicate");
  });
  it("recomputes corrected ER without requiring a win/loss, including complete games", () => {
    const original = {
      ...appearance(0),
      counts: { outsRecorded: 27, er: 2, r: 2 },
    };
    const corrected = {
      ...original,
      counts: { ...original.counts, er: 1 },
      inputRef: "revision:2",
      asOf: "2026-11-03T01:00:00Z",
    };
    expect(
      comparePitching([original], scope).starter.season.metrics.era.value,
    ).toBe(2);
    const result = comparePitching([corrected], scope).starter.season;
    expect(result.metrics.era.value).toBe(1);
    expect(result.gs).toBe(1);
    expect(result.inningsDisplay).toBe("9.0");
    expect(result.provenance[0].inputRef).toBe("revision:2");
  });
  it("counts zero-out relief appearances and all supplied totals", () => {
    const r = {
      ...appearance(0, "RELIEVER"),
      counts: {
        outsRecorded: 0,
        sv: 0,
        hld: 1,
        r: 1,
        er: 1,
        h: 1,
        hr: 1,
        so: 0,
        bb: 1,
        ibb: 1,
        hbp: 1,
        bf: 3,
      },
    };
    expect(comparePitching([r], scope).reliever.season).toMatchObject({
      g: 1,
      gs: 0,
      totals: r.counts,
    });
  });
});
