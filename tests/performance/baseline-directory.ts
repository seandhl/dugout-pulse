import "server-only";
import { readDemo } from "../../src/server/db/demo";
import { readHome } from "../../src/server/reads/home";
import type {
  DirectoryQuery,
  DirectoryResult,
} from "../../src/contracts/player-directory";
import type { Fixture } from "../../src/demo/generator";
import { battingStats } from "../../src/stats/batting";

export function selectDirectory(
  f: Fixture,
  query: DirectoryQuery,
  scores: ReturnType<typeof readHome>["players"] = [],
): DirectoryResult {
  const players = f.players
    .map((p) => {
      const role = p.listedRoles[0] === "batter" ? "hitter" : p.listedRoles[0];
      const appearances = f.games
        .filter((g) => g.status === "final")
        .flatMap((g) =>
          (role === "hitter" ? g.batting : g.pitching)
            .filter((l) => l.playerId === p.playerId)
            .map((l) => ({ ...l, date: g.date, gameId: g.gameId })),
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.gameId.localeCompare(a.gameId),
        );
      const recent = appearances.slice(0, Number(query.window));
      const outs = recent.reduce((n, l) => n + l.outsRecorded, 0);
      const score = scores.find((s) => s.playerId === p.playerId);
      return {
        id: p.playerId,
        name: p.displayName,
        role,
        teams: [...new Set(appearances.map((l) => l.teamId))],
        games: recent.length,
        ops: role === "hitter" ? battingStats(recent).metrics.ops.value : null,
        era:
          role !== "hitter" && outs > 0
            ? (recent.reduce((n, l) => n + l.er, 0) * 27) / outs
            : null,
        score: score?.score ?? null,
        confidence: score?.confidence ?? null,
        lastAppearance: appearances[0]?.date ?? null,
        source: p.sourceId,
        registration: {
          status: "unknown" as const,
          snapshotId: null,
          asOf: null,
          sourceId: null,
        },
      };
    })
    .filter(
      (p) =>
        (!query.q ||
          p.name.normalize("NFC").includes(query.q.normalize("NFC"))) &&
        (!query.role || p.role === query.role) &&
        (!query.team || p.teams.includes(query.team)) &&
        p.teams.length > 0,
    );
  players.sort((a, b) => {
    if (query.sort !== "name") {
      const key = query.sort;
      const av = a[key],
        bv = b[key];
      if (av === null && bv !== null) return 1;
      if (bv === null && av !== null) return -1;
      if (av !== null && bv !== null && av !== bv)
        return query.sort === "era" ? av - bv : bv - av;
    }
    return a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id);
  });
  const pages = Math.max(1, Math.ceil(players.length / 20));
  const page = Math.min(Number(query.page), pages);
  return {
    players: players.slice((page - 1) * 20, page * 20),
    total: players.length,
    page,
    pages,
    asOf: f.asOf,
    updatedAt: f.lastUpdatedAt,
    source: f.sourceId,
    season: f.season,
  };
}
const scoreCache = new Map<string, ReturnType<typeof readHome>["players"]>();
export function readDirectory(query: DirectoryQuery) {
  const fixture = readDemo();
  const key = `${fixture.releaseId}/${fixture.lastUpdatedAt}/${query.window}`;
  const cached = scoreCache.get(key);
  if (cached) return selectDirectory(fixture, query, cached);
  const scores = (["batter", "starter", "reliever"] as const).flatMap(
    (role) => readHome({ role, window: query.window }).players,
  );
  if (scoreCache.size >= 4) scoreCache.clear();
  scoreCache.set(key, scores);
  return selectDirectory(fixture, query, scores);
}
