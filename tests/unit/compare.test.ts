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

it("rejects three slots, unknown fields and repeated URL values without truncation", () => {
  for (const players of ["demo_0_00,demo_0_01,demo_0_02", ",,", "a,b,c,d"])
    expect(compareQuery.safeParse({ players }).success).toBe(false);
  expect(compareQuery.safeParse({ players: ["a", "b"] }).success).toBe(false);
  expect(compareQuery.safeParse({ unexpected: "1" }).success).toBe(false);
  expect(() =>
    selectComparison(generate(), {
      ...compareQuery.parse({}),
      players: "a,b,c",
    }),
  ).toThrow(/최대 2명/);
});

it("exposes distinct moving-window evidence with scope and provenance", () => {
  const view = selectComparison(
    generate(),
    compareQuery.parse({ players: "demo_0_10,demo_0_11", window: "5" }),
  );
  const basis = view.slots[0]!.d.comparisonBasis!;
  expect(basis.kind).toBe("moving_appearance_window");
  expect(basis.current).toMatchObject({
    season: 2026,
    competition: "regular",
    role: "starter",
    window: 5,
  });
  expect(basis.current.modelVersion).toBeTruthy();
  expect(basis.current.snapshotId).toBeTruthy();
  expect(basis.current.asOf).toBeTruthy();
  expect(basis.current.inputRefs).toHaveLength(5);
  expect(basis.previous!.inputRefs).toHaveLength(5);
  expect(
    basis.previous!.inputRefs.filter((ref) =>
      basis.current.inputRefs.includes(ref),
    ),
  ).toHaveLength(4);
});
