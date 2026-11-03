import "server-only";
import { readDemo } from "../db/demo";
import { readHome } from "./home";
import type {
  DirectoryQuery,
  DirectoryResult,
  DirectoryPlayer,
} from "../../contracts/player-directory";
import type { Fixture } from "../../demo/generator";
import { battingStats } from "../../stats/batting";

// Fixture objects are immutable publication snapshots. Replacing the fixture invalidates
// every derived row; WeakMap prevents retaining obsolete releases or unbounded searches.
const aggregates = new WeakMap<
  Fixture,
  Map<string, { scores: unknown; rows: DirectoryPlayer[] }>
>();
const noScores: ReturnType<typeof readHome>["players"] = [];
export function selectDirectory(
  f: Fixture,
  query: DirectoryQuery,
  scores: ReturnType<typeof readHome>["players"] = noScores,
): DirectoryResult {
  let windows = aggregates.get(f);
  if (!windows) aggregates.set(f, (windows = new Map()));
  let cached = windows.get(query.window);
  if (!cached || cached.scores !== scores) {
    type Appearance = Fixture["games"][number]["batting"][number] & {
      date: string;
      gameId: string;
    };
    const byPlayer = new Map<string, Appearance[]>();
    for (const g of f.games) {
      if (g.status !== "final") continue;
      for (const l of [...g.batting, ...g.pitching]) {
        const key = `${l.playerId}/${l.role ? "pitching" : "batting"}`;
        let rows = byPlayer.get(key);
        if (!rows) byPlayer.set(key, (rows = []));
        rows.push({ ...l, date: g.date, gameId: g.gameId });
      }
    }
    const scoreByPlayer = new Map(scores.map((s) => [s.playerId, s]));
    const rows = f.players.map((p) => {
      const role = p.listedRoles[0] === "batter" ? "hitter" : p.listedRoles[0];
      const appearances = (
        byPlayer.get(
          `${p.playerId}/${role === "hitter" ? "batting" : "pitching"}`,
        ) ?? []
      ).sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.gameId.localeCompare(a.gameId),
      );
      const recent = appearances.slice(0, Number(query.window));
      const outs = recent.reduce((n, l) => n + l.outsRecorded, 0);
      const score = scoreByPlayer.get(p.playerId);
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
      };
    });
    cached = { scores, rows };
    windows.set(query.window, cached);
  }
  const players = cached.rows.filter(
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
const scoreCache = new WeakMap<
  Fixture,
  Map<string, ReturnType<typeof readHome>["players"]>
>();
export function readDirectory(query: DirectoryQuery) {
  const fixture = readDemo();
  let cache = scoreCache.get(fixture);
  if (!cache) scoreCache.set(fixture, (cache = new Map()));
  let scores = cache.get(query.window);
  if (!scores) {
    scores = (["batter", "starter", "reliever"] as const).flatMap(
      (role) => readHome({ role, window: query.window }).players,
    );
    cache.set(query.window, scores);
  }
  return selectDirectory(fixture, query, scores);
}
