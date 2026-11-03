import { expect, it } from "vitest";
import { generate } from "../../src/demo/generator";
import { selectPlayerDetail } from "../../src/server/reads/player-detail";
import { selectPitcherDetail } from "../../src/server/reads/pitcher-detail";
import { battingStats } from "../../src/stats/batting";
import { pitchingStats } from "../../src/stats/pitching";

it("detail chart and log projections retain raw engine results and game provenance including DH", () => {
  const f = generate();
  const batter = selectPlayerDetail(f, "demo_0_00", "season")!;
  expect(batter.exportPolicy).toEqual({
    demo: true,
    exportAllowed: true,
    licenseId: "demo-self-authored-v1",
  });
  expect(batter.games.some((g) => g.order === 2)).toBe(true);
  for (const g of batter.games) {
    expect(g.stats).toEqual(battingStats([g.counts]));
    const raw = f.games.find((r) => r.gameId === g.id)!;
    const own = raw.batting.find((r) => r.playerId === batter.player.playerId)!;
    expect(g.opponent).toBe(
      f.teams.find(
        (t) => t.teamId === (own.teamId === raw.home ? raw.away : raw.home),
      )!.name,
    );
    expect(g.inputRef).toContain(g.id);
  }
  for (const role of ["starter", "reliever"] as const) {
    const d = selectPitcherDetail(f, "demo_0_12", role, "season")!;
    const summarize = (games: typeof d.games) =>
      pitchingStats(
        games.map((g) => ({
          counts: g.counts,
          walkDefinition: "includes_ibb",
        })),
      );
    d.games.forEach((g, i) => {
      expect(g.stats).toEqual(summarize([g]));
      expect(g.cumulative).toEqual(summarize(d.games.slice(0, i + 1)));
      expect(g.moving).toEqual(
        summarize(d.games.slice(Math.max(0, i - 4), i + 1)),
      );
    });
    expect(d.games.at(-1)!.cumulative).toEqual(d.recent);
  }
});
