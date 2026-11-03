import { expect, it } from "vitest";
import { generate } from "../../src/demo/generator";
import { compareQuery, selectComparison } from "../../src/server/reads/compare";
it("keeps shared scope, role isolation, missing rates and correct units", () => {
  const f = generate();
  const select = (players: string, extra = {}) =>
    selectComparison(f, compareQuery.parse({ players, ...extra }));
  const bat = select("demo_0_00,demo_0_01");
  expect(bat.comparable).toBe(true);
  expect(
    bat.slots[0]!.metrics.find((m) => m.label === "OBP")!.value,
  ).toBeNull();
  for (const role of ["starter", "reliever"] as const) {
    const d = select("demo_0_12,demo_0_12", { role1: role, role2: role })
      .slots[0]!;
    const outs = d.d.games.reduce(
      (n, g) => n + (g.counts as { outsRecorded: number }).outsRecorded,
      0,
    );
    expect(d.metrics.find((m) => m.label === "IP")!.value).toBe(outs / 3);
    const era = d.metrics.find((m) => m.label === "ERA")!;
    const er = d.d.games.reduce(
      (n, g) => n + (g.counts as { er: number }).er,
      0,
    );
    expect(era.value).toBeCloseTo((er * 27) / outs);
    const pct = d.metrics.find((m) => m.label === "K-BB%")!;
    expect(pct.text).toBe(`${(pct.value! * 100).toFixed(1)}%`);
  }
  expect(select("demo_0_00,demo_0_10").comparable).toBe(false);
  expect(select("demo_0_10,demo_0_14").comparable).toBe(false);
  expect(
    select("demo_0_00,demo_0_01", { competition: "postseason" }).slots,
  ).toEqual([null, null]);
  expect(select("demo_0_00", { season: 2025 }).available).toBe(false);
  expect(select("demo_0_00", { role1: "starter" }).slots).toEqual([null]);
  expect(compareQuery.safeParse({ window: "20" }).success).toBe(false);
  expect(compareQuery.safeParse({ q: ["x", "y"] }).success).toBe(false);
});
it("handles unknown players, no records and insufficient appearances", () => {
  const f = generate();
  f.games = [];
  const d = selectComparison(
    f,
    compareQuery.parse({ players: "demo_0_00,unknown" }),
  );
  expect(d.slots[0]!.metrics.every((m) => m.value === null)).toBe(true);
  expect(d.slots[0]!.d.recent.sample.appearances).toBe(0);
  expect(d.slots[1]).toBeNull();
});
