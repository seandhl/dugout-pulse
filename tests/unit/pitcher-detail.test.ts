import { expect, it } from "vitest";
import { generate } from "../../src/demo/generator";
import {
  selectPitcherDetail,
  pitcherQuery,
} from "../../src/server/reads/pitcher-detail";
import { formatInnings, pitchingStats } from "../../src/stats/pitching";
it("starter, reliever and mixed fixtures reconcile every role window and season", () => {
  const f = generate();
  for (const id of ["demo_0_10", "demo_0_14", "demo_0_12"]) {
    for (const role of ["starter", "reliever"] as const) {
      for (const window of [
        ...(role === "starter" ? ["3", "5", "10"] : ["5", "10", "20"]),
        "season",
      ]) {
        const d = selectPitcherDetail(f, id, role, window)!;
        const lines = f.games
          .filter((g) => g.status === "final")
          .flatMap((g) =>
            g.pitching.filter(
              (l) =>
                l.playerId === id &&
                l.role === (role === "starter" ? "STARTER" : "RELIEVER"),
            ),
          );
        const picked =
          window === "season" ? lines : lines.slice(-Number(window));
        const outs = picked.reduce((s, l) => s + l.outsRecorded, 0);
        const er = picked.reduce((s, l) => s + l.er, 0);
        expect(d.recent.totals.outsRecorded).toBe(picked.length ? outs : null);
        expect(d.recent.inningsDisplay).toBe(
          picked.length ? formatInnings(outs) : "N/A",
        );
        expect(d.recent.metrics.era.value).toBe(outs ? (er * 27) / outs : null);
        expect(d.games.map((g) => g.counts.outsRecorded)).toEqual(
          picked.map((l) => l.outsRecorded),
        );
        expect(d.recent.totals.pitches).toBeNull();
        expect(d.recent.totals.sv).toBeNull();
      }
    }
  }
  const a = selectPitcherDetail(f, "demo_0_12", "starter", "season")!;
  const b = selectPitcherDetail(f, "demo_0_12", "reliever", "season")!;
  expect(a.availableRoles).toEqual(["starter", "reliever"]);
  expect(
    a.roleSeason.totals.outsRecorded! + b.roleSeason.totals.outsRecorded!,
  ).toBe(a.season.totals.outsRecorded);
  expect(
    pitcherQuery.safeParse({ role: "starter", window: "20" }).success,
  ).toBe(false);
  expect(
    pitcherQuery.safeParse({ role: "reliever", window: "3" }).success,
  ).toBe(false);
});
it("5.2 innings means 17 outs; ratios use summed outs, including zero-out appearances", () => {
  const rows = [17, 1, 0].map((outsRecorded, i) => ({
    counts: {
      outsRecorded,
      er: i === 0 ? 2 : 1,
      r: 2,
      h: 2,
      bb: 1,
      so: 3,
      bf: 7,
    },
    walkDefinition: "includes_ibb" as const,
  }));
  expect(formatInnings(17)).toBe("5.2");
  const s = pitchingStats(rows);
  expect(s.inningsDisplay).toBe("6.0");
  expect(s.metrics.era.value).toBe(6);
  expect(s.metrics.whip.value).toBe(1.5);
  expect(s.metrics.kPer9.value).toBe(13.5);
  expect(s.metrics.bbPer9.value).toBe(4.5);
  expect(s.metrics.kMinusBbPct.value).toBe(6 / 21);
  expect(
    pitchingStats([{ ...rows[0], counts: { ...rows[0].counts, pitches: 90 } }])
      .totals.pitches,
  ).toBe(90);
});
