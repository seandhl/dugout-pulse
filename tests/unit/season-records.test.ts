import { expect, it } from "vitest";
import { generate } from "../../src/demo/generator";
import { selectPlayerDetail } from "../../src/server/reads/player-detail";
import { selectPitcherDetail } from "../../src/server/reads/pitcher-detail";

it("season RBI and provenance use final full-season appearances, independent of recent window", () => {
  const f = generate();
  const lines = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) => g.batting.filter((l) => l.playerId === "demo_0_00"));
  const a = selectPlayerDetail(f, "demo_0_00", "3")!;
  const b = selectPlayerDetail(f, "demo_0_00", "20")!;
  expect(a.seasonRecords.rbi).toBe(lines.reduce((sum, l) => sum + l.rbi, 0));
  expect(a.seasonRecords).toEqual(b.seasonRecords);
  expect(a.seasonRecords.inputRefs).toHaveLength(lines.length);
  expect(a.season.totals.sb).toBeNull();
  // Missing source RBI is never treated as zero.
  Reflect.deleteProperty(lines[0], "rbi");
  expect(selectPlayerDetail(f, "demo_0_00", "3")!.seasonRecords.rbi).toBeNull();
  f.games = [];
  expect(selectPlayerDetail(f, "demo_0_00", "3")!.seasonRecords).toEqual({
    rbi: null,
    inputRefs: [],
  });
});

it("mixed pitcher starts count only starter lines while season totals include both roles", () => {
  const f = generate();
  const lines = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) => g.pitching.filter((l) => l.playerId === "demo_0_12"));
  const a = selectPitcherDetail(f, "demo_0_12", "starter", "3")!;
  const b = selectPitcherDetail(f, "demo_0_12", "reliever", "5")!;
  expect(a.seasonRecords.gamesStarted).toBe(
    lines.filter((l) => l.role === "STARTER").length,
  );
  expect(a.seasonRecords).toEqual(b.seasonRecords);
  expect(a.seasonRecords.inputRefs).toHaveLength(lines.length);
  expect(a.season.sample.appearances).toBe(lines.length);
  expect(a.season.totals.sv).toBeNull();
  f.games = [];
  expect(
    selectPitcherDetail(f, "demo_0_12", "starter", "3")!.seasonRecords,
  ).toEqual({ gamesStarted: null, inputRefs: [] });
});
