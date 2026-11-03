import "server-only";
import { z } from "zod";
import type { BoardQuery } from "../../src/contracts/ranking-boards";
import type { PipelineState } from "../../src/server/ingest/pipeline";
import {
  modelVersion,
  type MomentumSnapshot,
  type PublicRole,
} from "../../src/server/reads/momentum";
import { kstDate } from "../../src/server/reads/scope";
import { rowKey } from "../../src/server/ingest/files";
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
export const displayNumber = (n: number) => Math.round(n * 10) / 10;
export function selectRankingBoards(state: PipelineState, q: BoardQuery) {
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
  function enrich(s: MomentumSnapshot) {
    const refs = new Set(s.inputRefs);
    const resolved = records.filter((r) =>
      refs.has(JSON.stringify([rowKey(r.kind, r.row), r.batchId, r.licenseId])),
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
      score: s.score === null ? null : displayNumber(s.score),
      deltaScore: s.deltaScore === null ? null : displayNumber(s.deltaScore),
      name: String(player?.row.display_name ?? s.playerId),
      teams: [
        ...new Set(
          [...new Map(logs.map((r) => [rowKey(r.kind, r.row), r])).values()]
            .sort((a, b) => {
              const played = (gameId: unknown) =>
                String(
                  resolved.find(
                    (r) => r.kind === "games" && r.row.game_id === gameId,
                  )?.row.played_on ?? "",
                );
              return (
                played(b.row.game_id).localeCompare(played(a.row.game_id)) ||
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
    const pages = Math.max(1, Math.ceil(ranked.length / 20));
    const page = Math.min(q.page, pages);
    return {
      role,
      total: ranked.length,
      pages,
      page,
      rows: ranked
        .slice((page - 1) * 20, page * 20)
        .map((s, i) => ({ ...s, rank: (page - 1) * 20 + i + 1 })),
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
