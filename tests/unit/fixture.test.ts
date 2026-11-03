import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { generate } from "../../src/demo/generator";
const fixture = generate();
describe("original synthetic fixture", () => {
  it("reproduces the release and covers roles, calendar and edge cases", () => {
    expect(generate()).toEqual(fixture);
    expect(
      createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),
    ).toBe("b4edf2587144678531eb831cb2c853693a6d5a33c536dad6896a541a436a1627");
    for (const c of fixture.corrections) {
      const game = fixture.games.find((g) => g.gameId === c.gameId)!;
      expect(game.revision).toBe(c.revision);
      expect(game.events[c.eventIndex]).toEqual(c.after);
      expect(c.before.outcome).toBe("strikeout");
      expect(c.after.outcome).toBe("out");
    }
    expect(generate(1)).not.toEqual(fixture);
    expect(fixture.teams).toHaveLength(10);
    expect(fixture.players.length).toBeGreaterThanOrEqual(60);
    for (const role of ["batter", "starter", "reliever"])
      expect(fixture.players.some((p) => p.listedRoles.includes(role))).toBe(
        true,
      );
    expect(
      new Set([
        ...fixture.games.map((g) => g.date),
        ...fixture.absences.map((a) => a.date),
      ]).size,
    ).toBe(30);
    for (const reason of ["rest", "injury", "did_not_play"])
      expect(fixture.absences.some((a) => a.reason === reason)).toBe(true);
    expect(fixture.trades).toHaveLength(1);
    expect(fixture.corrections).toHaveLength(1);
    expect(fixture.games.some((g) => g.doubleheaderNo === 2)).toBe(true);
    expect(fixture.games.some((g) => g.status === "cancelled")).toBe(true);
  });
  it("reconciles every event, opposing line, score and player summary", () => {
    const ids = new Set(fixture.players.map((p) => p.playerId));
    for (const g of fixture.games) {
      if (g.status === "cancelled") {
        expect(g.events).toHaveLength(0);
        expect(g.batting).toHaveLength(0);
        expect(g.pitching).toHaveLength(0);
        continue;
      }
      for (const b of g.batting) {
        expect(ids.has(b.playerId)).toBe(true);
        for (const value of Object.values(b))
          if (typeof value === "number") {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
          }
        expect(b.h).toBeLessThanOrEqual(b.ab);
        expect(b.doubles + b.triples + b.hr).toBeLessThanOrEqual(b.h);
        expect(b.pa).toBe(b.ab + b.bb);
        expect(
          g.events.filter(
            (e) => e.batter === b.playerId && e.outcome === "strikeout",
          ),
        ).toHaveLength(b.so);
        expect(g.events.filter((e) => e.batter === b.playerId)).toHaveLength(
          b.pa,
        );
        expect(
          g.events.filter(
            (e) => e.batter === b.playerId && e.outcome === "home_run",
          ),
        ).toHaveLength(b.hr);
        expect(
          fixture.absences.some(
            (a) =>
              a.playerId === b.playerId &&
              a.date === g.date &&
              a.reason === "injury",
          ),
        ).toBe(false);
        if (b.playerId === "demo_0_00")
          expect(b.teamId).toBe(
            g.date >= "2026-10-16" ? "sample_1" : "sample_0",
          );
      }
      for (const p of g.pitching) {
        const events = g.events.filter((e) => e.pitcher === p.playerId);
        expect(events).toHaveLength(p.bf);
        expect(events.filter((e) => e.outcome !== "home_run")).toHaveLength(
          p.outsRecorded,
        );
        expect(events.filter((e) => e.outcome === "home_run")).toHaveLength(
          p.h,
        );
      }
      for (const team of [g.home, g.away]) {
        const bat = g.batting.filter((b) => b.teamId === team);
        const pitch = g.pitching.filter((p) => p.teamId !== team);
        const sum = (rows: typeof bat, key: keyof (typeof bat)[number]) =>
          rows.reduce((s, b) => s + Number(b[key]), 0);
        expect(sum(pitch, "outsRecorded")).toBe(27);
        for (const key of ["h", "hr", "r", "so", "bb"] as const)
          expect(sum(bat, key)).toBe(sum(pitch, key));
        expect(sum(bat, "r")).toBe(team === g.home ? g.homeRuns : g.awayRuns);
      }
    }
    for (const p of fixture.players) {
      const lines = fixture.games
        .flatMap((g) =>
          p.listedRoles[0] === "batter" ? g.batting : g.pitching,
        )
        .filter((b) => b.playerId === p.playerId);
      expect(p.sampleSize).toBe(lines.length);
      for (const [key, value] of Object.entries(p.stats))
        expect(value).toBe(
          lines.reduce((s, b) => s + Number(b[key as keyof typeof b]), 0),
        );
    }
  });
});
