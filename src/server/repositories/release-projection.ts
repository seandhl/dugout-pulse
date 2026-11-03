import "server-only";
import { createHash } from "node:crypto";
import type { Fixture } from "../../demo/generator";
import type { PipelineState } from "../ingest/pipeline";
import { modelVersion } from "../reads/momentum-version";
import { FileError, rowKey } from "../ingest/files";
import { selectHome } from "../reads/home-projection";
import { homeResponse, type HomeData } from "../../contracts/home";

export type Release = {
  schemaVersion: 1;
  releaseId: string;
  revision: number;
  asOf: string;
  modelVersion: string;
  sourceIds: string[];
  licenseIds: string[];
  provenance: Record<
    string,
    {
      key: string;
      batchId: string;
      sourceId: string;
      licenseId: string;
      asOf: string;
    }[]
  >;
  fixture: Fixture;
  homes: Record<string, HomeData>;
  state: PipelineState;
};
export const releaseHash = (release: Release) =>
  createHash("sha256").update(JSON.stringify(release)).digest("hex");

/** A complete replacement, never an overlay on the unrelated SQLite fixture. */
export function projectRelease(state: PipelineState): Release {
  const records = Object.values(state.records);
  if (
    records.some(
      (r) => r.row.season !== 2026 || r.row.competition !== "regular",
    )
  )
    throw new FileError(422, "통합 DEMO 게시는 2026 정규시즌만 지원합니다.");
  const revision = state.revision;
  const asOf =
    records
      .map((r) => String(r.row.as_of))
      .sort()
      .at(-1) ?? "2026-11-03T00:00:00.000Z";
  const releaseId = `demo_r${revision}_${createHash("sha256").update(JSON.stringify(state.records)).digest("hex").slice(0, 16)}`;
  const byKind = (kind: string) =>
    records.filter((r) => r.kind === kind).map((r) => r.row);
  const teamIds = new Set<string>();
  for (const r of records)
    for (const key of ["team_id", "home_team_id", "away_team_id"])
      if (typeof r.row[key] === "string") teamIds.add(String(r.row[key]));
  const blank = () => ({
    ab: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    r: 0,
    rbi: 0,
    so: 0,
    pa: 0,
    bb: 0,
    outsRecorded: 0,
    er: 0,
    bf: 0,
  });
  const players: Fixture["players"] = byKind("players")
    .filter((r) => r.person_type !== "COACH" && r.role !== "COACH")
    .map((r) => ({
      playerId: String(r.player_id),
      displayName: String(r.display_name),
      listedRoles: [
        r.role === "BATTER"
          ? "batter"
          : r.role === "STARTER"
            ? "starter"
            : "reliever",
      ],
      sourceId: "demo-file-source",
      teamId: String(
        byKind("rosters")
          .filter((x) => x.player_id === r.player_id)
          .sort((a, b) =>
            String(a.snapshot_on).localeCompare(String(b.snapshot_on)),
          )
          .at(-1)?.team_id ?? "demo_unknown",
      ),
      sampleSize: 0,
      stats: blank(),
    }));
  const games: Fixture["games"] = byKind("games").map((r) => ({
    gameId: String(r.game_id),
    date: String(r.played_on),
    home: String(r.home_team_id),
    away: String(r.away_team_id),
    doubleheaderNo: Number(r.doubleheader_no),
    status: String(r.status).toLowerCase(),
    revision,
    batting: [],
    pitching: [],
    events: [],
    homeRuns: 0,
    awayRuns: 0,
  }));
  for (const kind of ["batting_game_logs", "pitching_game_logs"] as const)
    for (const row of byKind(kind)) {
      const required =
        kind === "batting_game_logs"
          ? [
              "r",
              "rbi",
              "ab",
              "h",
              "doubles",
              "triples",
              "hr",
              "so",
              "pa",
              "bb",
              "hbp",
              "sf",
              "sac",
              "ci",
            ]
          : ["outs", "h", "er", "so", "bb", "hr", "bf", "r", "ibb", "hbp"];
      if (
        required.some((k) => typeof row[k] !== "number") ||
        (kind === "pitching_game_logs" &&
          row.walk_definition !== "includes_ibb")
      )
        throw new FileError(
          422,
          "통합 게시에 필요한 상세 필드가 없습니다. 누락 수치를 추정하지 않습니다.",
        );
      const game = games.find((g) => g.gameId === row.game_id);
      const player = players.find((p) => p.playerId === row.player_id);
      if (!game || !player)
        throw new FileError(422, "통합 게시의 선수·경기 참조가 없습니다.");
      const line: Fixture["games"][number]["batting"][number] = {
        ...blank(),
        playerId: player.playerId,
        teamId: String(row.team_id),
        r: Number(row.r),
        rbi: Number(row.rbi ?? 0),
        hbp: Number(row.hbp),
        sf: Number(row.sf ?? 0),
        sac: Number(row.sac ?? 0),
        ci: Number(row.ci ?? 0),
        ibb: Number(row.ibb ?? 0),
        ab: Number(row.ab ?? 0),
        h: Number(row.h),
        doubles: Number(row.doubles ?? 0),
        triples: Number(row.triples ?? 0),
        hr: Number(row.hr),
        so: Number(row.so),
        pa: Number(row.pa ?? 0),
        bb: Number(row.bb),
        outsRecorded: Number(row.outs ?? 0),
        er: Number(row.er ?? 0),
        bf: Number(row.bf ?? 0),
        ...(kind === "pitching_game_logs"
          ? { role: row.role as "STARTER" | "RELIEVER" }
          : {}),
      };
      (kind === "batting_game_logs" ? game.batting : game.pitching).push(line);
      player.sampleSize++;
      for (const key of Object.keys(
        player.stats,
      ) as (keyof typeof player.stats)[])
        player.stats[key] += line[key];
    }
  const fixture: Fixture = {
    version: "2.0.0",
    seed: 0,
    algorithm: "self-authored file projection v1",
    releaseId,
    demo: true,
    sourceId: "demo-file-source",
    season: 2026,
    competition: "regular",
    asOf,
    lastUpdatedAt: asOf,
    teams: [...teamIds].map((teamId) => ({ teamId, name: `DEMO ${teamId}` })),
    players,
    games,
    absences: [],
    trades: [],
    corrections: [],
  };
  const homes: Release["homes"] = {};
  for (const role of ["batter", "starter", "reliever"] as const)
    for (const window of ["3", "5", "10", "20"] as const)
      homes[`${role}/${window}`] = homeResponse.parse(
        selectHome(fixture, { role, window }),
      );
  // No batches, raw uploads, credentials or recursive release history in public snapshots.
  const publicState: PipelineState = structuredClone({
    ...state,
    batches: {},
    publication: undefined,
    releases: undefined,
  });
  const provenance: Release["provenance"] = {};
  for (const game of games)
    for (const line of [...game.batting, ...game.pitching]) {
      provenance[`${releaseId}/${game.gameId}/${line.playerId}/r${revision}`] =
        records
          .filter(
            (r) =>
              (r.kind === "games" && r.row.game_id === game.gameId) ||
              (r.kind === "players" && r.row.player_id === line.playerId) ||
              (r.row.game_id === game.gameId &&
                r.row.player_id === line.playerId) ||
              (r.kind === "rosters" &&
                r.row.player_id === line.playerId &&
                r.row.snapshot_on === game.date),
          )
          .map((r) => ({
            key: rowKey(r.kind, r.row),
            batchId: r.batchId,
            sourceId: r.sourceId,
            licenseId: r.licenseId,
            asOf: String(r.row.as_of),
          }));
    }
  return {
    schemaVersion: 1,
    modelVersion,
    sourceIds: [...new Set(records.map((r) => r.sourceId))],
    licenseIds: [...new Set(records.map((r) => r.licenseId))],
    provenance,
    releaseId,
    revision,
    asOf,
    fixture,
    homes,
    state: publicState,
  };
}
