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
  const cacheKey = JSON.stringify([
    query.season,
    f.competition,
    query.team,
    query.window,
  ]);
  let cached = windows.get(cacheKey);
  if (!cached || cached.scores !== scores) {
    type Appearance = Fixture["games"][number]["batting"][number] & {
      date: string;
      gameId: string;
      order: number;
    };
    const byPlayer = new Map<string, Appearance[]>();
    for (const g of f.games) {
      if (
        g.status !== "final" ||
        String(f.season) !== query.season ||
        f.competition !== "regular"
      )
        continue;
      for (const l of [...g.batting, ...g.pitching]) {
        const key = `${l.playerId}/${l.role ? "pitching" : "batting"}`;
        let rows = byPlayer.get(key);
        if (!rows) byPlayer.set(key, (rows = []));
        rows.push({
          ...l,
          date: g.date,
          gameId: g.gameId,
          order: g.doubleheaderNo,
        });
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
          b.date.localeCompare(a.date) ||
          b.order - a.order ||
          b.gameId.localeCompare(a.gameId),
      );
      const scoped = appearances.filter(
        (l) =>
          (!query.team || l.teamId === query.team) &&
          (role === "hitter" ||
            l.role === (role === "starter" ? "STARTER" : "RELIEVER")),
      );
      const recent = scoped.slice(0, Number(query.window));
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
        lastAppearance: scoped[0]?.date ?? null,
        source: p.sourceId,
        registration: {
          status: "unknown" as const,
          snapshotId: null,
          asOf: null,
          sourceId: null,
        },
      };
    });
    cached = { scores, rows };
    windows.set(cacheKey, cached);
  }
  const players = cached.rows.filter(
    (p) =>
      (!query.q ||
        p.name.normalize("NFC").includes(query.q.normalize("NFC"))) &&
      (!query.role || p.role === query.role) &&
      // games is already team/role scoped; season membership alone is insufficient.
      p.games > 0 &&
      (!query.sample ||
        (query.sample === "complete" && p.games === Number(query.window)) ||
        (query.sample === "short" && p.games < Number(query.window)) ||
        (query.sample === "unscored" && p.score === null)),
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
    teams: f.teams,
    playerCount: f.players.length,
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
