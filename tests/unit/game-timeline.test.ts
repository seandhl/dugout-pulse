import { expect, it } from "vitest";
import { gameTimeline } from "../../src/ui/game-timeline";
it("preserves DH and ID order, exposes calendar gaps without creating appearances or mutating input", () => {
  const games = [
    { id: "c", date: "2026-10-07", order: 1 },
    { id: "b", date: "2026-10-01", order: 2 },
    { id: "a", date: "2026-10-01", order: 1 },
  ];
  expect(gameTimeline(games)).toEqual([
    { ...games[2], gapDays: null },
    { ...games[1], gapDays: 0 },
    { ...games[0], gapDays: 5 },
  ]);
  expect(games[0].id).toBe("c");
  expect(gameTimeline([])).toEqual([]);
});
