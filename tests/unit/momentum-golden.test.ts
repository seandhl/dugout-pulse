import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { calculateMomentum, type Role } from "../../src/stats/momentum";
import { fixture, momentumScenario } from "../../fixtures/stats/momentum-input";
import golden from "../../fixtures/stats/momentum-golden.json";

it.each(golden)("golden $id", (g) => {
  const input = momentumScenario(g.role as Role, g.variant);
  const before = structuredClone(input);
  const r = calculateMomentum(input);
  expect(r.status).toBe(g.status);
  expect(r.reason).toBe(g.reason);
  expect(r.score).toBe(g.score);
  expect(r.label).toBe(g.label);
  expect(r.confidence).toBe(g.confidence);
  if (g.rawScore !== null) expect(r.rawScore).toBeCloseTo(g.rawScore, 11);
  else expect(r.rawScore).toBeNull();
  expect(r.algorithmVersion).toBe("momentum_v0_1_0");
  expect(r.sourceMode).toBe("demo");
  expect(r.asOf).toBe(input.cutoffAt);
  expect(r.warnings).toContain("demo");
  expect(input).toEqual(before);
  expect(calculateMomentum(input)).toEqual(r);
  expect(
    calculateMomentum({ ...input, rows: [...input.rows].reverse() }),
  ).toEqual(r);
  if (r.status === "ready") {
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    expect(r.reasons.length).toBeLessThanOrEqual(4);
    expect(r.n?.appearances).toBe(g.role === "starting_pitcher" ? 5 : 10);
  }
});

it("recalculates corrected records without mutating the original input", () => {
  const input = fixture();
  const corrected = {
    ...input,
    rows: input.rows.map((r) =>
      r.playerId === "target" && r.gameId === "g20"
        ? { ...r, revision: 2, counts: { ...r.counts, h: 3, doubles: 1 } }
        : r,
    ),
  };
  expect(calculateMomentum(corrected).score).not.toBe(
    calculateMomentum(input).score,
  );
  expect(calculateMomentum(corrected).warnings).toContain("record_corrected");
  expect(calculateMomentum(input).score).toBe(50);
});

it("documentation matches every fixed golden value", () => {
  const doc = readFileSync(
    new URL("../../docs/MOMENTUM_MODEL.md", import.meta.url),
    "utf8",
  );
  for (const g of golden) {
    const raw = g.rawScore === null ? "null" : g.rawScore.toFixed(12);
    expect(doc).toContain(
      `| ${g.id} | ${raw} | ${g.score === null ? "null" : g.score.toFixed(1)} | ${g.label ?? g.reason} | ${g.confidence ?? "null"} |`,
    );
  }
});

it.each(["starting_pitcher", "relief_pitcher"] as const)(
  "%s excludes the other pitching role",
  (role) => {
    const input = fixture(role);
    const other =
      role === "starting_pitcher"
        ? ("relief_pitcher" as const)
        : ("starting_pitcher" as const);
    const mixed = {
      ...input,
      rows: [
        ...input.rows,
        ...input.rows.map((r) => ({
          ...r,
          role: other,
          gameId: `other-${r.gameId}`,
          counts: { ...r.counts, so: 10, bb: 0, h: 1 },
        })),
      ],
    };
    const r = calculateMomentum(mixed);
    expect(r.score).toBe(calculateMomentum(input).score);
    expect(r.n).toEqual(calculateMomentum(input).n);
    expect(r.warnings).toContain("role_changed");
  },
);
