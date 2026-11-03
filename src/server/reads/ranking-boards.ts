import "server-only";
import { publicationBasis } from "./comparison-basis";
import { z } from "zod";
import type { BoardQuery } from "../../contracts/ranking-boards";
import type { PipelineState } from "../ingest/pipeline";
import type { MomentumSnapshot, PublicRole } from "./momentum";
import { modelVersion } from "./momentum-version";
import { kstDate } from "./scope";
import { rowKey } from "../ingest/files";
const summary = z
  .object({
    W: z
      .object({
        appearances: z.number(),
        opportunities: z.number().nullable(),
        outs: z.number().nullable(),
        metrics: z.record(
          z.string(),
          z.object({ value: z.number().nullable() }).passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();
export const boardRoles = ["hitter", "starter", "reliever"] as const;
export function selectRankingBoards(
  state: PipelineState,
  q: BoardQuery,
  limit = 20,
) {
  const scoped = Object.values(state.momentumSnapshots ?? {}).filter(
    (s) =>
      s.season === q.season &&
      s.competition === q.competition &&
      s.window === Number(q.window),
  );
  const date =
    q.date ??
    scoped
      .map((s) => kstDate(s.asOf))
      .sort()
      .at(-1) ??
    kstDate(new Date().toISOString());
  const dated = scoped.filter((s) => kstDate(s.asOf) === date);
  // A publication is atomic. Never fill gaps from another revision or scoring version.
  const revision = Math.max(0, ...dated.map((s) => s.publicationRevision));
  const current = (state.momentumCurrent ?? [])
    .map((id) => state.momentumSnapshots?.[id])
    .filter(
      (s): s is MomentumSnapshot =>
        !!s &&
        s.season === q.season &&
        s.competition === q.competition &&
        s.window === Number(q.window),
    );
  const currentDate = current
    .map((s) => kstDate(s.asOf))
    .sort()
    .at(-1);
  const release =
    currentDate === date
      ? current.filter((s) => kstDate(s.asOf) === date)
      : dated.filter((s) => s.publicationRevision === revision);
  const compatible =
    release.length > 0 &&
    release.every(
      (s) =>
        s.algorithmVersion === modelVersion && s.modelVersion === modelVersion,
    );
  const snapshots = compatible ? release : [];
  const records = [
    ...Object.values(state.records),
    ...state.history.flatMap((h) =>
      [h.before, h.after].filter((r) => r !== undefined),
    ),
  ];
  // Resolve provenance once, preserving duplicate historical versions and ordering.
  const byRef = new Map<string, typeof records>();
  for (const r of records) {
    const key = JSON.stringify([rowKey(r.kind, r.row), r.batchId, r.licenseId]);
    const group = byRef.get(key);
    if (group) group.push(r);
    else byRef.set(key, [r]);
  }
  const recordOrder = new Map(records.map((r, i) => [r, i]));
  function enrich(s: MomentumSnapshot) {
    const resolved = [...new Set(s.inputRefs)]
      .flatMap((ref) => byRef.get(ref) ?? [])
      .sort((a, b) => recordOrder.get(a)! - recordOrder.get(b)!);
    const gamesById = new Map(
      resolved.filter((r) => r.kind === "games").map((r) => [r.row.game_id, r]),
    );
    const player = resolved.find(
      (r) => r.kind === "players" && r.row.player_id === s.playerId,
    );
    const logs = resolved.filter(
      (r) =>
        r.row.player_id === s.playerId &&
        r.kind ===
          (s.role === "hitter" ? "batting_game_logs" : "pitching_game_logs") &&
        (s.role === "hitter" ||
          r.row.role === (s.role === "starter" ? "STARTER" : "RELIEVER")),
    );
    const lastGame = resolved.find(
      (r) => r.kind === "games" && r.row.game_id === s.dataAsOfGameId,
    );
    const parsed = summary.safeParse(s.rawFeatureSummary);
    const w = parsed.success ? parsed.data.W : null;
    const min =
      s.role === "hitter"
        ? [3, 30, 0]
        : s.role === "starter"
          ? [2, 75, 45]
          : [3, 30, 18];
    const enough =
      !!w &&
      s.sampleSize >= min[0] &&
      w.appearances >= min[0] &&
      (w.opportunities ?? -1) >= min[1] &&
      (min[2] === 0 || (w.outs ?? -1) >= min[2]);
    return {
      ...s,
      comparisonBasis: publicationBasis(state, s),
      name: String(player?.row.display_name ?? s.playerId),
      teams: [
        ...new Set(
          [...new Map(logs.map((r) => [rowKey(r.kind, r.row), r])).values()]
            .sort((a, b) => {
              const played = (gameId: unknown) =>
                String(gamesById.get(gameId)?.row.played_on ?? "");
              return (
                played(b.row.game_id).localeCompare(played(a.row.game_id)) ||
                Number(gamesById.get(b.row.game_id)?.row.doubleheader_no ?? 1) -
                  Number(
                    gamesById.get(a.row.game_id)?.row.doubleheader_no ?? 1,
                  ) ||
                String(b.row.game_id).localeCompare(String(a.row.game_id))
              );
            })
            .slice(0, s.sampleSize)
            .map((r) => String(r.row.team_id)),
        ),
      ],
      lastAppearance: lastGame ? String(lastGame.row.played_on) : null,
      summary: w,
      enough,
    };
  }
  // Team is a membership filter within the published global window.
  // Never recompute scores, features or eligibility against a team population.
  const enriched = snapshots.map(enrich);
  const teams = [...new Set(enriched.flatMap((s) => s.teams))].sort();
  const boards = boardRoles.map((role: PublicRole) => {
    const rows = enriched.filter(
      (s) => s.role === role && (!q.team || s.teams.includes(q.team)),
    );
    const eligible = rows.filter(
      (s) =>
        s.enough &&
        s.eligibility.eligible &&
        s.rankingStatus === "ranked" &&
        s.score !== null &&
        ["medium", "high"].includes(s.confidence ?? ""),
    );
    const value = (s: (typeof enriched)[number]) =>
      q.sort === "score" ? s.score! : s.deltaScore!;
    const ranked = eligible
      .filter(
        (s) =>
          q.sort === "score" ||
          (s.deltaScore !== null &&
            (q.sort === "decline" ? s.deltaScore < 0 : s.deltaScore > 0)),
      )
      .sort(
        (a, b) =>
          (q.sort === "decline" ? value(a) - value(b) : value(b) - value(a)) ||
          (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
      );
    // Rank the entire filtered population before slicing: ties can span pages.
    let rank = 0;
    const withRanks = ranked.map((s, i) => {
      if (i === 0 || value(s) !== value(ranked[i - 1])) rank = i + 1;
      return { ...s, rank };
    });
    const pages = Math.max(1, Math.ceil(ranked.length / limit));
    const page = Math.min(q.page, pages);
    return {
      role,
      total: ranked.length,
      pages,
      page,
      rows: withRanks.slice((page - 1) * limit, page * limit),
      excludedRows: rows.filter((s) => !ranked.includes(s)),
      excluded: rows.filter((s) => !eligible.includes(s)).length,
      noPrevious: eligible.filter((s) => s.deltaScore === null).length,
    };
  });
  return {
    date,
    revision,
    scoringVersion: modelVersion,
    stale: !compatible,
    teams,
    boards,
  };
}
