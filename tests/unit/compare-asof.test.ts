import { expect, it, vi } from "vitest";
import { generate } from "../../src/demo/generator";
import { compareQuery, selectComparison } from "../../src/server/reads/compare";

// Only the detail timestamp is changed: real calculations, scope and provenance
// still come from the reproducible DEMO fixture. No production test backdoor.
vi.mock("../../src/server/reads/player-detail", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/server/reads/player-detail")
    >();
  return {
    ...actual,
    selectPlayerDetail: (
      ...args: Parameters<typeof actual.selectPlayerDetail>
    ) => {
      const detail = actual.selectPlayerDetail(...args);
      return detail && args[1] === "demo_0_01"
        ? { ...detail, asOf: "2026-01-01T00:00:00.000Z" }
        : detail;
    },
  };
});

it("blocks direct numeric comparison for two valid same-role players at different asOf", () => {
  const view = selectComparison(
    generate(),
    compareQuery.parse({ players: "demo_0_00,demo_0_01" }),
  );
  expect(view.slots.every(Boolean)).toBe(true);
  expect(view.slots[0]!.role).toBe(view.slots[1]!.role);
  expect(view.asOfMismatch).toBe(true);
  expect(view.comparable).toBe(false);
  expect(view.slots[0]!.d.source).toBeTruthy();
});
