import "server-only";
import { z } from "zod";
import { date } from "../ingest/files";
import type { PipelineState } from "../ingest/pipeline";
export const kstDate = (instant: string) =>
  new Date(Date.parse(instant) + 9 * 3600000).toISOString().slice(0, 10);
export const scopeInput = z
  .object({
    season: z.coerce.number().int().min(1900).max(9999),
    competition: z
      .enum(["regular", "postseason", "allstar", "exhibition"])
      .default("regular"),
    date: date.default(() => kstDate(new Date().toISOString())),
    search: z.enum(["appeared", "registered"]).default("appeared"),
    q: z.string().trim().max(100).default(""),
  })
  .strict();
export const freshnessPolicy = {
  staleThresholdHours: 48,
  rosterDefaultValidity: "SNAPSHOT_DATE_ONLY",
  scheduler: "DISABLED",
  alert: "PLACEHOLDER_NOT_CONNECTED",
} as const;
type RecordVersion = PipelineState["records"][string];
export function scopeView(
  state: PipelineState,
  input: z.infer<typeof scopeInput>,
  records: RecordVersion[],
  now = new Date().toISOString(),
) {
  const scoped = records;
  const rosters = scoped.filter(
    (r) => r.kind === "rosters" && String(r.row.snapshot_on) <= input.date,
  );
  const latestDate = rosters
    .map((r) => String(r.row.snapshot_on))
    .sort()
    .at(-1);
  // Unknown or expired latest snapshots never fall back to an older registration.
  const snapshot = rosters.filter((r) => r.row.snapshot_on === latestDate);
  const valid =
    snapshot.length > 0 &&
    snapshot.every(
      (r) =>
        r.row.status !== "UNKNOWN" &&
        String(r.row.valid_until ?? r.row.snapshot_on) >= input.date,
    );
  const registered = valid
    ? snapshot.filter(
        (r) => r.row.status === "REGISTERED" && r.row.person_type !== "COACH",
      )
    : [];
  const games = scoped.filter(
    (r) => r.kind === "games" && r.row.played_on === input.date,
  );
  const logs = scoped.filter(
    (r) =>
      ["batting_game_logs", "pitching_game_logs"].includes(r.kind) &&
      scoped.some(
        (g) =>
          g.kind === "games" &&
          g.row.game_id === r.row.game_id &&
          g.row.status === "FINAL" &&
          String(g.row.played_on) <= input.date,
      ),
  );
  const ids = new Set(
    (input.search === "registered" ? registered : logs).map(
      (r) => r.row.player_id,
    ),
  );
  const players = scoped
    .filter(
      (r) =>
        r.kind === "players" &&
        r.row.person_type !== "COACH" &&
        r.row.role !== "COACH" &&
        ids.has(r.row.player_id) &&
        String(r.row.display_name).includes(input.q.normalize("NFC")),
    )
    .map((r) => {
      const appearances = logs.filter(
        (l) => l.row.player_id === r.row.player_id,
      );
      const dates = appearances
        .map((l) =>
          String(
            scoped.find(
              (g) => g.kind === "games" && g.row.game_id === l.row.game_id,
            )?.row.played_on,
          ),
        )
        .sort();
      return {
        ...r,
        lastAppearanceDate: dates.at(-1) ?? null,
        sampleSize: new Set(appearances.map((l) => l.row.game_id)).size,
        dataAsOf:
          appearances
            .map((l) => String(l.row.as_of))
            .sort()
            .at(-1) ?? null,
      };
    });
  const asOf =
    scoped
      .map((r) => String(r.row.as_of))
      .sort()
      .at(-1) ?? null;
  // Batch validation/publication records are persisted atomically by the existing pipeline.
  const runs = state.runs?.length
    ? state.runs
    : Object.values(state.batches)
        .map((b) => ({
          batchId: b.report.importBatchId,
          attemptedAt: b.report.importedAt,
          successfulAt: b.publishedAt ?? null,
          status: b.report.status,
          failReason:
            b.report.issues
              .filter((i) => i.severity === "error")
              .map((i) => i.message)
              .join("; ") || null,
        }))
        .sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
  return {
    demo: true,
    ...input,
    policy: freshnessPolicy,
    asOf,
    stale:
      !asOf ||
      Date.parse(now) - Date.parse(asOf) >
        freshnessPolicy.staleThresholdHours * 3600000,
    rosterStatus: valid ? "VALID" : "NO_ENTRY_INFORMATION",
    rosterMessage: valid ? `등록 기준일 ${latestDate}` : "엔트리 정보 없음",
    snapshotAsOfDate: latestDate ?? null,
    rosterSnapshots: rosters,
    currentRoster: registered,
    teamHistory: rosters.map((r) => ({
      playerId: r.row.player_id,
      personType: r.row.person_type ?? "PLAYER",
      teamId: r.row.team_id,
      effectiveOn: r.row.effective_on,
      asOfDate: r.row.snapshot_on,
      asOf: r.row.as_of,
      sourceId: r.sourceId,
      batchId: r.batchId,
    })),
    players,
    games,
    gameLogs: logs.filter((l) =>
      games.some((g) => g.row.game_id === l.row.game_id),
    ),
    pipeline: {
      runs,
      lastAttempted: runs.at(-1)?.attemptedAt ?? null,
      lastSuccessful:
        runs
          .map((r) => r.successfulAt)
          .filter((v): v is string => v !== null)
          .sort()
          .at(-1) ?? null,
    },
    availableSeasons: [
      ...new Set(Object.values(state.records).map((r) => Number(r.row.season))),
    ].sort((a, b) => b - a),
  };
}
