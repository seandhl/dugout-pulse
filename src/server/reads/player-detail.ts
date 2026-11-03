import "server-only";
import { movingBasis } from "./comparison-basis";
import { z } from "zod";
import type { Fixture } from "@/demo/generator";
import { battingStats } from "@/stats/batting";
import { MODEL, scoreMomentum, type Row } from "@/stats/momentum";
export const detailQuery = z
  .object({ window: z.enum(["3", "5", "10", "20", "season"]).default("10") })
  .strict();
export function selectPlayerDetail(f: Fixture, id: string, window: string) {
  const player = f.players.find(
    (p) => p.playerId === id && p.listedRoles.includes("batter"),
  );
  if (!player) return null;
  const rows: Row[] = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) =>
      g.batting.map((l) => ({
        leagueId: "demo",
        season: f.season,
        competition: "regular" as const,
        role: "hitter" as const,
        playerId: l.playerId,
        gameId: g.gameId,
        playedOn: g.date,
        doubleheaderNo: g.doubleheaderNo,
        releaseId: f.releaseId,
        status: "FINAL" as const,
        completedAt: f.asOf,
        asOf: f.asOf,
        revision: g.revision,
        sourceId: f.sourceId,
        inputRef: `${f.releaseId}/${g.gameId}/${l.playerId}/r${g.revision}`,
        counts: l,
        walkDefinition: "includes_ibb" as const,
      })),
    )
    .sort(
      (a, b) =>
        a.playedOn.localeCompare(b.playedOn) ||
        a.doubleheaderNo - b.doubleheaderNo ||
        a.gameId.localeCompare(b.gameId),
    );
  const own = rows.filter((r) => r.playerId === id);
  const selected = window === "season" ? own : own.slice(-Number(window));
  const summarize = (r: Row[]) => battingStats(r.map((x) => x.counts));
  const recent = summarize(selected),
    season = summarize(own);
  const momentum =
    window === "season"
      ? null
      : scoreMomentum({
          leagueId: "demo",
          season: f.season,
          competition: "regular",
          role: "hitter",
          window: Number(window) as 3 | 5 | 10 | 20,
          playerId: id,
          cutoffAt: f.asOf,
          releaseId: f.releaseId,
          demo: true,
          rights: "demo_allowed",
          revisionsResolved: true,
          coverageComplete: true,
          lastAppearanceDate: own.at(-1)?.playedOn ?? null,
          roster: { status: "unknown", asOf: f.asOf, sourceId: f.sourceId },
          rows,
        });
  return {
    player,
    team:
      f.teams.find(
        (t) =>
          t.teamId ===
          f.games
            .filter((g) => g.status === "final")
            .flatMap((g) =>
              g.batting
                .filter((l) => l.playerId === id)
                .map((l) => ({ ...l, date: g.date })),
            )
            .sort((a, b) => a.date.localeCompare(b.date))
            .at(-1)?.teamId,
      )?.name ?? "소속 미상",
    seasonYear: f.season,
    competition: "정규시즌",
    asOf: f.asOf,
    updatedAt: f.lastUpdatedAt,
    source: f.sourceId,
    exportPolicy: {
      demo: true,
      exportAllowed: true,
      licenseId: "demo-self-authored-v1",
    },
    comparisonBasis: movingBasis(f, "hitter", window, own),
    modelVersion: MODEL,
    window,
    lastAppearance: own.at(-1)?.playedOn ?? null,
    recent,
    season,
    momentum,
    games: selected.map((r, i) => ({
      id: r.gameId,
      date: r.playedOn,
      order: r.doubleheaderNo,
      opponent: (() => {
        const game = f.games.find((g) => g.gameId === r.gameId)!;
        const team = game.batting.find((l) => l.playerId === id)!.teamId;
        const opponent = team === game.home ? game.away : game.home;
        return f.teams.find((t) => t.teamId === opponent)?.name ?? opponent;
      })(),
      counts: r.counts,
      source: r.sourceId,
      inputRef: r.inputRef,
      stats: battingStats([r.counts]),
      cumulative: summarize(selected.slice(0, i + 1)),
      moving: summarize(selected.slice(Math.max(0, i - 4), i + 1)),
    })),
  };
}
export type PlayerDetail = NonNullable<ReturnType<typeof selectPlayerDetail>>;
