import { generate, type Fixture } from "./generator.ts";
/** Original DEMO stress panel: four independent rosters, six chronological cycles.
 * Not official records. Counts are cloned, IDs/dates are deterministic and unique. */
export function generatePerformance(): Fixture {
  const base = generate();
  const id = (value: string, cohort: number) => `${value}_p${cohort}`;
  const day = (date: string, cycle: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) - (5 - cycle) * 31 * 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    ...base,
    releaseId: "synthetic_performance_v1",
    sourceId: "synthetic_performance_v1",
    players: Array.from({ length: 4 }, (_, c) =>
      base.players.map((p) => ({
        ...p,
        playerId: id(p.playerId, c),
        displayName: `${p.displayName} P${c}`,
        sourceId: "synthetic_performance_v1",
        sampleSize: p.sampleSize * 6,
        stats: Object.fromEntries(
          Object.entries(p.stats).map(([k, v]) => [k, v * 6]),
        ) as typeof p.stats,
      })),
    ).flat(),
    games: Array.from({ length: 4 }, (_, c) =>
      Array.from({ length: 6 }, (_, cycle) =>
        base.games.map((g) => ({
          ...g,
          gameId: `${id(g.gameId, c)}_c${cycle}`,
          date: day(g.date, cycle),
          batting: g.batting.map((l) => ({
            ...l,
            playerId: id(l.playerId, c),
          })),
          pitching: g.pitching.map((l) => ({
            ...l,
            playerId: id(l.playerId, c),
          })),
          events: g.events.map((e) => ({
            ...e,
            batter: id(e.batter, c),
            pitcher: id(e.pitcher, c),
          })),
        })),
      ),
    ).flat(2),
    absences: [],
    trades: [],
    corrections: [],
  };
}
