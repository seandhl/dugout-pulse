import { describe, expect, it } from "vitest";
import examples from "../../fixtures/stats/hand-calculated.json";
import {
  battingStats,
  compareBatting,
  formatMetric,
  type Counts,
  type Appearance,
} from "../../src/stats/batting";
import { publishedBatting } from "../../src/server/reads/batting";
describe("raw batting formulas", () => {
  for (const example of examples)
    it(example.name, () => {
      const result = battingStats(example.rows as Counts[]);
      const metric =
        result.metrics[example.metric as keyof typeof result.metrics];
      if (example.expected === null) expect(metric.value).toBeNull();
      else expect(metric.value).toBeCloseTo(example.expected, 12);
    });
  it("sums every count and derives singles/TB without mutating", () => {
    const row = {
      pa: 8,
      ab: 4,
      h: 4,
      doubles: 1,
      triples: 1,
      hr: 1,
      bb: 1,
      hbp: 1,
      sf: 1,
      sac: 1,
      ci: 0,
      so: 0,
      sb: 2,
      cs: 1,
    };
    const result = battingStats([Object.freeze(row), row]);
    for (const [key, value] of Object.entries(row))
      expect(result.totals[key as keyof Counts]).toBe(value * 2);
    expect(result.singles).toBe(2);
    expect(result.tb).toBe(20);
    expect(result.paValidation).toBe("verified");
  });
  it("validates PA per row and includes SAC and interference, excluding SAC from OBP", () => {
    expect(() =>
      battingStats([{ pa: 5, ab: 2, bb: 0, hbp: 0, sf: 1, sac: 1, ci: 0 }]),
    ).toThrow("PA mismatch");
    expect(
      battingStats([
        { pa: 5, ab: 2, h: 1, bb: 0, hbp: 0, sf: 1, sac: 1, ci: 1 },
      ]).metrics.obp.value,
    ).toBeCloseTo(1 / 3);
    expect(battingStats([{ pa: 5, ab: 4 }]).paValidation).toBe("unverifiable");
  });
  it("handles empty, zero, missing, invalid and small samples", () => {
    expect(battingStats([]).metrics.avg.value).toBeNull();
    expect(battingStats([{ pa: 0, ab: 0, h: 0 }]).metrics.avg.reason).toBe(
      "zero_denominator",
    );
    expect(battingStats([{ pa: 1, ab: 1, h: 1 }], 5).metrics.avg.reason).toBe(
      "small_sample",
    );
    expect(battingStats([{ ab: 1, h: 1 }]).sample.label).toBe("PA 표본 미확인");
    for (const row of [
      { ab: -1 },
      { h: NaN },
      { h: 1.5 },
      { ab: 1, h: 2 },
      { h: 1, hr: 2 },
      { pa: 1, ab: 2 },
      { ab: 1, so: 2 },
    ])
      expect(() => battingStats([row])).toThrow();
    expect(formatMetric(battingStats([{}]).metrics.avg)).toBe("N/A");
    expect(formatMetric(battingStats([{ pa: 3, bb: 1 }]).metrics.bbPct)).toBe(
      "33.3%",
    );
    expect(
      formatMetric(battingStats([{ pa: 3, ab: 3, h: 1 }]).metrics.avg),
    ).toBe("0.333");
  });
  it("selects last player appearances across gaps and doubleheaders", () => {
    const rows: Appearance[] = Array.from({ length: 21 }, (_, i) => ({
      gameId: `g${i}`,
      playedOn: `2026-10-${String(Math.floor(i / 2) + 1).padStart(2, "0")}`,
      order: (i % 2) + 1,
      counts: { pa: 1, ab: 1, h: i < 18 ? 0 : 1 },
      inputRef: `r${i}`,
      sourceId: "DEMO",
      asOf: "2026-11-01T00:00:00Z",
    }));
    const result = compareBatting(rows.reverse());
    for (const n of [3, 5, 10, 20]) {
      expect(result.recent[n].sample.appearances).toBe(n);
      expect(result.recent[n].metrics.avg.value).toBeCloseTo(3 / n);
    }
    expect(result.season.metrics.avg.value).toBeCloseTo(3 / 21);
    expect(result.recent[3].provenance[0].gameId).toBe("g20");
    expect(compareBatting(rows.slice(0, 1)).recent[3].windowComplete).toBe(
      false,
    );
    expect(() => compareBatting([rows[0], rows[0]])).toThrow("Duplicate");
  });
  it("connects published final games with provenance, excluding unplayed games", () => {
    const meta = { sourceId: "DEMO", batchId: "b", licenseId: "l" };
    const result = publishedBatting([
      {
        ...meta,
        kind: "games",
        row: { game_id: "g", status: "FINAL", played_on: "2026-10-01" },
      },
      {
        ...meta,
        kind: "batting_game_logs",
        row: {
          game_id: "g",
          player_id: "p",
          pa: 4,
          ab: 4,
          h: 2,
          hr: 0,
          as_of: "2026-11-01T00:00:00Z",
        },
      },
    ]);
    expect(result.p.season.metrics.avg.value).toBe(0.5);
    expect(result.p.season.metrics.obp.reason).toBe("missing_fields");
    expect(result.p.demo).toBe(true);
  });
});
