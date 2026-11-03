import "server-only";
import { createHash } from "node:crypto";
import {
  createMomentumBatchScorer,
  MODEL,
  type Row,
  type Role,
  type Input,
} from "../../stats/momentum";
import { fields } from "../../stats/batting";
import { pitchingFields } from "../../stats/pitching";
import type { PipelineState } from "../ingest/pipeline";

export const windows = [3, 5, 10, 20] as const;
export type PublicRole = "hitter" | "starter" | "reliever";
const roles: Record<PublicRole, Role> = {
  hitter: "hitter",
  starter: "starting_pitcher",
  reliever: "relief_pitcher",
};
export const modelVersion = `${MODEL}_windows_v1`;
export type MomentumSnapshot = {
  id: string;
  playerId: string;
  role: PublicRole;
  season: number;
  competition: "regular" | "postseason";
  modelVersion: string;
  algorithmVersion: string;
  computedAt: string;
  asOf: string;
  dataAsOfGameId: string | null;
  window: number;
  windowBasis: string;
  rawFeatureSummary: unknown;
  score: number | null;
  confidence: string | null;
  eligibility: { eligible: boolean; reason: string | null };
  explanation: unknown;
  deltaScore: number | null;
  previousSnapshotId: string | null;
  sourceIds: string[];
  inputRefs: string[];
  sampleSize: number;
  demo: true;
  publicationRevision: number;
  rankingStatus: string;
};
const ascii = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const canonical = (x: unknown): string => {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return `[${x.map(canonical).join(",")}]`;
  return `{${Object.entries(x)
    .sort(([a], [b]) => ascii(a, b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
};
/** Runs inside the publication transaction; old immutable snapshots are never deleted. */
// The generator keeps transaction-local partial work private until the atomic rename.
function* momentumBatches(state: PipelineState, computedAt: string) {
  state.momentumSnapshots ??= {};
  state.momentumCurrent = [];
  const records = Object.entries(state.records).sort(([a], [b]) => ascii(a, b));
  const revisions = new Map<string, number>();
  for (const h of state.history)
    if (h.before) revisions.set(h.key, (revisions.get(h.key) ?? 0) + 1);
  const scopeCache = new Map<string, ReturnType<typeof prepareScope>>();
  function prepareScope(season: number, competition: "regular" | "postseason") {
    const scoped = records.filter(
      ([, r]) => r.row.season === season && r.row.competition === competition,
    );
    const asOf = scoped
      .map(([, r]) => String(r.row.as_of))
      .sort()
      .at(-1)!;
    const releaseId = "published-demo";
    const rows: Row[] = [];
    const games = new Map(
      scoped
        .filter(([, r]) => r.kind === "games")
        .map(([, r]) => [r.row.game_id, r.row]),
    );
    for (const [key, record] of scoped) {
      if (!["batting_game_logs", "pitching_game_logs"].includes(record.kind))
        continue;
      const r = record.row;
      const game = games.get(r.game_id);
      if (!game || game.status !== "FINAL") continue;
      const counts: Row["counts"] = {};
      for (const field of [...fields, ...pitchingFields]) {
        const value = r[field === "outsRecorded" ? "outs" : field];
        if (typeof value === "number") counts[field] = value;
      }
      // Missing BB definition is missing evidence, never assume whether IBB is included.
      if (record.kind === "pitching_game_logs" && !r.walk_definition)
        counts.bb = null;
      rows.push({
        leagueId: "demo",
        season,
        competition,
        playerId: String(r.player_id),
        role:
          record.kind === "batting_game_logs"
            ? "hitter"
            : r.role === "STARTER"
              ? "starting_pitcher"
              : "relief_pitcher",
        gameId: String(r.game_id),
        playedOn: String(game.played_on),
        doubleheaderNo: Number(game.doubleheader_no ?? 1),
        releaseId,
        status: "FINAL",
        completedAt: String(game.as_of),
        asOf: String(r.as_of),
        revision: 1 + (revisions.get(key) ?? 0),
        sourceId: record.sourceId,
        inputRef: canonical([key, record.batchId, record.licenseId]),
        counts,
        walkDefinition:
          r.walk_definition === "excludes_ibb"
            ? "excludes_ibb"
            : "includes_ibb",
      });
    }
    return {
      scoped,
      asOf,
      releaseId,
      rows,
      score: createMomentumBatchScorer(rows),
    };
  }
  for (const [, player] of records.filter(([, r]) => r.kind === "players")) {
    yield; // bounded player batch; permit public requests between batches
    const season = Number(player.row.season),
      competition = player.row.competition;
    if (competition !== "regular" && competition !== "postseason") continue;
    const scopeKey = `${season}/${competition}`;
    let scope = scopeCache.get(scopeKey);
    if (!scope) {
      scope = prepareScope(season, competition);
      scopeCache.set(scopeKey, scope);
    }
    const { scoped, asOf, releaseId, rows } = scope;
    for (const role of Object.keys(roles) as PublicRole[]) {
      const listed = String(player.row.role);
      if (
        !(
          listed === (role === "hitter" ? "BATTER" : role.toUpperCase()) ||
          rows.some(
            (r) =>
              r.playerId === player.row.player_id && r.role === roles[role],
          )
        )
      )
        continue;
      const own = rows
        .filter(
          (r) => r.playerId === player.row.player_id && r.role === roles[role],
        )
        .sort(
          (a, b) =>
            ascii(a.playedOn, b.playedOn) ||
            a.doubleheaderNo - b.doubleheaderNo ||
            ascii(a.gameId, b.gameId),
        );
      const roster = scoped
        .filter(
          ([, r]) =>
            r.kind === "rosters" && r.row.player_id === player.row.player_id,
        )
        .sort(([, a], [, b]) =>
          ascii(String(a.row.snapshot_on), String(b.row.snapshot_on)),
        )
        .at(-1)?.[1];
      for (const window of windows) {
        const input: Input = {
          leagueId: "demo",
          season,
          competition,
          role: roles[role],
          playerId: String(player.row.player_id),
          window,
          cutoffAt: asOf,
          releaseId,
          demo: true as const,
          rights: "demo_allowed" as const,
          revisionsResolved: true,
          coverageComplete: true,
          lastAppearanceDate: own.at(-1)?.playedOn ?? null,
          roster: {
            status:
              roster?.row.status === "REGISTERED"
                ? ("registered" as const)
                : roster?.row.status === "UNREGISTERED"
                  ? ("unregistered" as const)
                  : ("unknown" as const),
            asOf: String(roster?.row.as_of ?? asOf),
            sourceId: roster?.sourceId ?? player.sourceId,
          },
          rows,
        };
        if (
          roster?.row.valid_until &&
          String(roster.row.valid_until) <
            new Date(Date.parse(asOf) + 9 * 3600000).toISOString().slice(0, 10)
        )
          input.roster.status = "unknown";
        const id = createHash("sha256")
          .update(canonical({ modelVersion, input }))
          .digest("hex");
        if (!state.momentumSnapshots[id]) {
          const result = scope.score(input);
          const previous = Object.values(state.momentumSnapshots)
            .filter(
              (s) =>
                s.playerId === input.playerId &&
                s.role === role &&
                s.window === window &&
                s.season === season &&
                s.competition === competition &&
                s.algorithmVersion === modelVersion &&
                s.score !== null &&
                s.eligibility.eligible,
            )
            .sort((a, b) => b.publicationRevision - a.publicationRevision)[0];
          const rankingStatus =
            result.rawScore === null
              ? "unscored"
              : input.roster.status !== "registered"
                ? "inactive_roster"
                : result.confidence === "low"
                  ? "low_confidence"
                  : "ranked";
          state.momentumSnapshots[id] = {
            id,
            playerId: input.playerId,
            role,
            season,
            competition,
            modelVersion,
            algorithmVersion: modelVersion,
            computedAt,
            asOf,
            dataAsOfGameId: own.at(-1)?.gameId ?? null,
            window,
            windowBasis:
              role === "hitter"
                ? "최근 타격 출전 경기"
                : role === "starter"
                  ? "최근 선발 등판"
                  : "최근 구원 등판",
            rawFeatureSummary:
              result.explanation && "summaries" in result.explanation
                ? result.explanation.summaries
                : null,
            score: result.rawScore,
            confidence: result.confidence,
            eligibility: {
              eligible: rankingStatus === "ranked",
              reason: rankingStatus === "ranked" ? null : rankingStatus,
            },
            explanation: {
              sourceIds: [...new Set(scoped.map(([, r]) => r.sourceId))],
              asOf,
              calculation: result,
            },
            deltaScore:
              result.rawScore !== null && previous
                ? result.rawScore - previous.score!
                : null,
            previousSnapshotId: previous?.id ?? null,
            sourceIds: [...new Set(scoped.map(([, r]) => r.sourceId))],
            inputRefs: scoped.map(([key, r]) =>
              canonical([key, r.batchId, r.licenseId]),
            ),
            sampleSize: Math.min(window, own.length),
            demo: true,
            publicationRevision: state.revision,
            rankingStatus,
          };
        }
        state.momentumCurrent.push(id);
      }
    }
  }
}
export function publishMomentum(state: PipelineState, computedAt: string) {
  for (const _batch of momentumBatches(state, computedAt)) void _batch;
}
export async function publishMomentumBatched(
  state: PipelineState,
  computedAt: string,
) {
  for (const _batch of momentumBatches(state, computedAt)) {
    void _batch;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
export function momentumView(
  state: PipelineState,
  query: {
    season: number;
    competition: string;
    role: PublicRole;
    window: number;
    sort?: "score" | "change";
    page?: number;
    limit?: number;
  },
  playerId?: string,
) {
  const snapshots = (state.momentumCurrent ?? [])
    .map((id) => state.momentumSnapshots![id])
    .filter(
      (s) =>
        s.season === query.season &&
        s.competition === query.competition &&
        s.role === query.role &&
        s.window === query.window &&
        (!playerId || s.playerId === playerId),
    );
  const value = (s: MomentumSnapshot) =>
    query.sort === "change" ? s.deltaScore : s.score;
  const ranked = snapshots
    .filter((s) => s.rankingStatus === "ranked" && value(s) !== null)
    .sort((a, b) => value(b)! - value(a)! || ascii(a.playerId, b.playerId));
  const rankedIds = new Set(ranked.map((s) => s.id));
  const excluded = playerId
    ? []
    : snapshots.filter((s) => !rankedIds.has(s.id));
  const limit = Math.min(20, Math.max(1, query.limit ?? 20));
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * limit;
  const paged = query.page !== undefined;
  return {
    data: playerId
      ? snapshots
      : ranked
          .slice(paged ? offset : 0, paged ? offset + limit : undefined)
          .map((s, i) => ({ ...s, rank: offset + i + 1 })),
    excluded: paged ? excluded.slice(offset, offset + limit) : excluded,
    ...(playerId
      ? {}
      : {
          pagination: {
            page,
            limit,
            total: ranked.length,
            excludedTotal: excluded.length,
            hasMore: offset + limit < Math.max(ranked.length, excluded.length),
          },
        }),
    meta: {
      demo: true,
      sourceMode: "DEMO",
      revision: state.revision,
      modelVersion,
      windowBasis:
        query.role === "hitter"
          ? "최근 타격 출전 경기"
          : query.role === "starter"
            ? "최근 선발 등판"
            : "최근 구원 등판",
      recommendedWindow: query.role === "starter" ? 5 : 10,
      ...query,
    },
    error: null,
  };
}
