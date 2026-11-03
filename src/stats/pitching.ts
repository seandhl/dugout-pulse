/** Pure pitching calculations. BB is normalized to include IBB before summing. */
import type { Metric } from "./batting";

export const pitchingFields = [
  "outsRecorded",
  "sv",
  "hld",
  "r",
  "er",
  "h",
  "hr",
  "so",
  "bb",
  "ibb",
  "hbp",
  "bf",
  "pitches",
] as const;
export type PitchingField = (typeof pitchingFields)[number];
export type PitchingCounts = Partial<Record<PitchingField, number | null>>;
export type PitchingRole = "STARTER" | "RELIEVER";
export type WalkDefinition = "includes_ibb" | "excludes_ibb";
export interface PitchingRow {
  counts: PitchingCounts;
  walkDefinition: WalkDefinition;
}
export interface PitchingScope {
  playerId: string;
  season: number;
  competition: "regular" | "postseason";
}
export interface PitchingAppearance extends PitchingRow, PitchingScope {
  gameId: string;
  playedOn: string;
  order: number;
  role: PitchingRole;
  sourceId: string;
  asOf: string;
  inputRef: string;
}
const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

export function formatInnings(outsRecorded: number | null): string {
  if (outsRecorded === null) return "N/A";
  if (!valid(outsRecorded)) throw new Error("Invalid outsRecorded");
  return `${Math.floor(outsRecorded / 3)}.${outsRecorded % 3}`;
}

export function pitchingStats(rows: readonly PitchingRow[]) {
  const normalized = rows.map(({ counts, walkDefinition }) => {
    if (walkDefinition !== "includes_ibb" && walkDefinition !== "excludes_ibb")
      throw new Error("Unknown BB/IBB definition");
    for (const f of pitchingFields)
      if (counts[f] != null && !valid(counts[f]))
        throw new Error(`Invalid ${f}`);
    if (counts.er != null && counts.r != null && counts.er > counts.r)
      throw new Error("ER exceeds R");
    if (counts.hr != null && counts.h != null && counts.hr > counts.h)
      throw new Error("HR exceeds H");
    if (
      walkDefinition === "includes_ibb" &&
      counts.ibb != null &&
      counts.bb != null &&
      counts.ibb > counts.bb
    )
      throw new Error("IBB exceeds inclusive BB");
    for (const f of ["sv", "hld"] as const)
      if (counts[f] != null && counts[f] > 1)
        throw new Error(`Invalid ${f} per appearance`);
    if (counts.sv === 1 && counts.hld === 1)
      throw new Error("SV and HLD are mutually exclusive");
    const bb =
      walkDefinition === "includes_ibb"
        ? counts.bb
        : counts.bb == null || counts.ibb == null
          ? null
          : counts.bb + counts.ibb;
    if (bb != null && !valid(bb)) throw new Error("Unsafe BB total");
    if (
      counts.bf != null &&
      (counts.h ?? 0) + (bb ?? 0) + (counts.hbp ?? 0) + (counts.so ?? 0) >
        counts.bf
    )
      throw new Error("BF components exceed BF");
    return { ...counts, bb };
  });
  const totals = Object.fromEntries(
    pitchingFields.map((f) => {
      const sum = normalized.reduce((s, r) => s + (r[f] ?? 0), 0);
      if (!valid(sum)) throw new Error("Unsafe total");
      return [
        f,
        normalized.length > 0 && normalized.every((r) => r[f] != null)
          ? sum
          : null,
      ];
    }),
  ) as Record<PitchingField, number | null>;
  const ip = totals.outsRecorded === null ? null : totals.outsRecorded / 3;
  const metric = (
    n: number | null,
    d: number | null,
    unit: Metric["unit"] = "ratio",
  ): Metric => ({
    value: n === null || d === null || d === 0 ? null : n / d,
    numerator: n,
    denominator: d,
    unit,
    reason:
      n === null || d === null
        ? "missing_fields"
        : d === 0
          ? "zero_denominator"
          : null,
  });
  const perNine = (n: number | null) => metric(n === null ? null : 9 * n, ip);
  return {
    totals,
    ip,
    inningsDisplay: formatInnings(totals.outsRecorded),
    sample: {
      appearances: rows.length,
      outsRecorded: totals.outsRecorded,
      bf: totals.bf,
      label: rows.length === 0 ? "등판 없음" : "기술통계 표본 (추론 아님)",
    },
    metrics: {
      era: perNine(totals.er),
      whip: metric(
        totals.bb === null || totals.h === null ? null : totals.bb + totals.h,
        ip,
      ),
      kPer9: perNine(totals.so),
      bbPer9: perNine(totals.bb),
      hrPer9: perNine(totals.hr),
      kPct: metric(totals.so, totals.bf, "percent"),
      bbPct: metric(totals.bb, totals.bf, "percent"),
      kMinusBbPct: metric(
        totals.so === null || totals.bb === null ? null : totals.so - totals.bb,
        totals.bf,
        "percent",
      ),
      // No verified league/season constant contract exists yet. Never assume one.
      fip: {
        value: null,
        reason: "league_season_constant_unavailable",
      } as const,
    },
  };
}

/** Latest authoritative revision per game must be resolved by the caller first. */
export function comparePitching(
  rows: readonly PitchingAppearance[],
  scope: PitchingScope,
) {
  if (
    !scope.playerId ||
    !Number.isSafeInteger(scope.season) ||
    scope.season < 1900 ||
    !["regular", "postseason"].includes(scope.competition)
  )
    throw new Error("Invalid pitching scope");
  const scoped = rows.filter(
    (r) =>
      r.playerId === scope.playerId &&
      r.season === scope.season &&
      r.competition === scope.competition,
  );
  if (new Set(scoped.map((r) => r.gameId)).size !== scoped.length)
    throw new Error(
      "Duplicate appearance; resolve corrections before aggregation",
    );
  for (const r of scoped) {
    if (
      !["STARTER", "RELIEVER"].includes(r.role) ||
      !Number.isSafeInteger(r.order) ||
      r.order < 1
    )
      throw new Error("Invalid appearance role/order");
    if (
      !r.gameId ||
      !r.sourceId ||
      !r.inputRef ||
      !Number.isFinite(Date.parse(r.asOf)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.playedOn) ||
      new Date(`${r.playedOn}T00:00:00Z`).toISOString().slice(0, 10) !==
        r.playedOn
    )
      throw new Error("Invalid appearance provenance/date");
  }
  const sorted = [...scoped].sort(
    (a, b) =>
      b.playedOn.localeCompare(a.playedOn) ||
      b.order - a.order ||
      b.gameId.localeCompare(a.gameId),
  );
  const series = (role: PitchingRole, windows: readonly number[]) => {
    const selected = sorted.filter((r) => r.role === role);
    const summarize = (
      appearances: readonly PitchingAppearance[],
      requested: number | null,
    ) => ({
      ...pitchingStats(appearances),
      scope: { ...scope, role },
      g: appearances.length,
      gs: role === "STARTER" ? appearances.length : 0,
      requested,
      windowComplete: requested === null || appearances.length >= requested,
      provenance: appearances.map((r) => ({
        gameId: r.gameId,
        playerId: r.playerId,
        season: r.season,
        competition: r.competition,
        playedOn: r.playedOn,
        order: r.order,
        role: r.role,
        sourceId: r.sourceId,
        asOf: r.asOf,
        inputRef: r.inputRef,
        walkDefinition: r.walkDefinition,
      })),
    });
    return {
      season: summarize(selected, null),
      recent: Object.fromEntries(
        windows.map((n) => [n, summarize(selected.slice(0, n), n)]),
      ),
    };
  };
  return {
    starter: series("STARTER", [3, 5, 10]),
    reliever: series("RELIEVER", [5, 10, 20]),
  };
}
