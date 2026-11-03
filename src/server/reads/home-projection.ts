import type { Fixture } from "../../demo/generator";
import {
  createMomentumBatchScorer,
  MODEL,
  type Row,
  type Role,
} from "../../stats/momentum";
import type { z } from "zod";
import type { homeQuery } from "../../contracts/home";
export function selectHome(f: Fixture, query: z.infer<typeof homeQuery>) {
  const playerById = new Map(f.players.map((p) => [p.playerId, p]));
  const role: Role =
    query.role === "batter"
      ? "hitter"
      : query.role === "starter"
        ? "starting_pitcher"
        : "relief_pitcher";
  const rows: Row[] = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) =>
      (query.role === "batter" ? g.batting : g.pitching)
        .filter((line) =>
          playerById.get(line.playerId)?.listedRoles.includes(query.role),
        )
        .map((line) => ({
          leagueId: "demo",
          season: f.season,
          competition: "regular" as const,
          role,
          playerId: line.playerId,
          gameId: g.gameId,
          playedOn: g.date,
          doubleheaderNo: g.doubleheaderNo,
          releaseId: f.releaseId,
          status: "FINAL" as const,
          completedAt: f.asOf,
          asOf: f.asOf,
          revision: g.revision,
          sourceId: f.sourceId,
          inputRef: `${f.releaseId}/${g.gameId}/${line.playerId}/r${g.revision}`,
          counts: { ...line, hbp: 0, sf: 0, sac: 0, ci: 0, ibb: 0 },
          walkDefinition: "includes_ibb" as const,
        })),
    );
  const score = createMomentumBatchScorer(rows);
  const players = f.players
    .filter((p) => p.listedRoles.includes(query.role))
    .map((p) => {
      const own = rows.filter((r) => r.playerId === p.playerId);
      const lastAppearance =
        own
          .map((r) => r.playedOn)
          .sort()
          .at(-1) ?? null;
      const result = score(
        {
          leagueId: "demo",
          season: f.season,
          competition: "regular",
          role,
          window: Number(query.window) as 3 | 5 | 10 | 20,
          playerId: p.playerId,
          cutoffAt: f.asOf,
          releaseId: f.releaseId,
          demo: true,
          rights: "demo_allowed",
          revisionsResolved: true,
          coverageComplete: true,
          lastAppearanceDate: lastAppearance,
          roster: { status: "unknown", asOf: f.asOf, sourceId: f.sourceId },
        },
        { includeInputHash: false },
      );
      return {
        playerId: p.playerId,
        name: p.displayName,
        team: f.teams.find((t) => t.teamId === p.teamId)?.name ?? "소속 미상",
        sourceId: p.sourceId,
        sampleSize: Math.min(Number(query.window), own.length),
        lastAppearance,
        score: result.rawScore,
        confidence: result.confidence,
        reason: result.status,
      };
    });
  return {
    demo: true as const,
    season: f.season,
    competition: "정규시즌",
    asOf: f.asOf,
    lastUpdatedAt: f.lastUpdatedAt,
    lastGame:
      f.games
        .filter((g) => g.status === "final")
        .map((g) => g.date)
        .sort()
        .at(-1) ?? null,
    source: f.sourceId,
    model: MODEL,
    window: Number(query.window),
    players,
  };
}
