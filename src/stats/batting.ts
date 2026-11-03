/** Pure raw-count calculations. No I/O, clocks, or per-game rate averaging. */
export const fields = [
  "pa",
  "ab",
  "h",
  "doubles",
  "triples",
  "hr",
  "bb",
  "hbp",
  "sf",
  "sac",
  "ci",
  "so",
  "sb",
  "cs",
] as const;
export type Field = (typeof fields)[number];
export type Counts = Partial<Record<Field, number | null>>;
export interface Appearance {
  gameId: string;
  playedOn: string;
  order: number;
  counts: Counts;
  inputRef: string;
  sourceId: string;
  asOf: string;
}
export type Metric = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  reason: "missing_fields" | "zero_denominator" | "small_sample" | null;
  unit: "ratio" | "percent" | "count";
};
const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function battingStats(rows: readonly Counts[], minPA = 1) {
  if (!Number.isSafeInteger(minPA) || minPA < 1)
    throw new Error("minPA must be a positive integer");
  for (const row of rows) {
    for (const field of fields)
      if (row[field] != null && !valid(row[field]))
        throw new Error(`Invalid ${field}`);
    if (row.h != null && row.ab != null && row.h > row.ab)
      throw new Error("H exceeds AB");
    if (row.so != null && row.ab != null && row.so > row.ab)
      throw new Error("SO exceeds AB");
    if (
      row.h != null &&
      ["doubles", "triples", "hr"].reduce(
        (s, f) => s + (row[f as Field] ?? 0),
        0,
      ) > row.h
    )
      throw new Error("Extra-base hits exceed H");
    if (
      row.pa != null &&
      ["ab", "bb", "hbp", "sf", "sac", "ci"].reduce(
        (s, f) => s + (row[f as Field] ?? 0),
        0,
      ) > row.pa
    )
      throw new Error("PA components exceed PA");
  }
  const totals = Object.fromEntries(
    fields.map((f) => {
      const values = rows.map((r) => r[f]);
      const sum = values.reduce<number>((s, n) => s + (n ?? 0), 0);
      if (!Number.isSafeInteger(sum)) throw new Error("Unsafe total");
      return [f, rows.length && values.every(valid) ? sum : null];
    }),
  ) as Record<Field, number | null>;
  const paFields: Field[] = ["ab", "bb", "hbp", "sf", "sac", "ci"];
  const paValidation =
    rows.length &&
    rows.every((r) => r.pa != null && paFields.every((f) => r[f] != null))
      ? rows.every((r) => r.pa === paFields.reduce((s, f) => s + r[f]!, 0))
        ? "verified"
        : "mismatch"
      : "unverifiable";
  if (
    rows.some(
      (r) =>
        r.pa != null &&
        paFields.every((f) => r[f] != null) &&
        r.pa !== paFields.reduce((s, f) => s + r[f]!, 0),
    )
  )
    throw new Error("PA mismatch");
  const add = (...fs: Field[]) =>
    fs.every((f) => totals[f] !== null)
      ? fs.reduce((s, f) => s + totals[f]!, 0)
      : null;
  const singles =
    add("h", "doubles", "triples", "hr") === null
      ? null
      : totals.h! - totals.doubles! - totals.triples! - totals.hr!;
  const tb =
    singles === null
      ? null
      : singles + 2 * totals.doubles! + 3 * totals.triples! + 4 * totals.hr!;
  const smallSample = totals.pa !== null ? totals.pa < minPA : minPA > 1;
  const metric = (
    n: number | null,
    d: number | null,
    unit: Metric["unit"] = "ratio",
  ): Metric => ({
    value: n === null || d === null || d === 0 || smallSample ? null : n / d,
    numerator: n,
    denominator: d,
    reason:
      n === null || d === null
        ? "missing_fields"
        : d === 0
          ? "zero_denominator"
          : smallSample
            ? "small_sample"
            : null,
    unit,
  });
  const avg = metric(totals.h, totals.ab),
    obp = metric(add("h", "bb", "hbp"), add("ab", "bb", "hbp", "sf")),
    slg = metric(tb, totals.ab);
  const combine = (a: Metric, b: Metric, sign: number): Metric => ({
    value:
      a.value === null || b.value === null ? null : a.value + sign * b.value,
    numerator: null,
    denominator: null,
    reason: a.reason ?? b.reason,
    unit: "ratio",
  });
  return {
    totals,
    singles,
    tb,
    paValidation,
    sample: {
      appearances: rows.length,
      pa: totals.pa,
      minPA,
      label: !rows.length
        ? "출전 없음"
        : smallSample
          ? "표본 부족"
          : totals.pa === null
            ? "PA 표본 미확인"
            : "기술통계 표본 (추론 아님)",
    },
    metrics: {
      avg,
      obp,
      slg,
      ops: combine(obp, slg, 1),
      iso: combine(slg, avg, -1),
      bbPct: metric(totals.bb, totals.pa, "percent"),
      kPct: metric(totals.so, totals.pa, "percent"),
      hrPerPA: metric(totals.hr, totals.pa),
      hPerPA: metric(totals.h, totals.pa),
      sb: metric(totals.sb, 1, "count"),
      cs: metric(totals.cs, 1, "count"),
    },
  };
}
export function compareBatting(rows: readonly Appearance[], minPA = 1) {
  if (new Set(rows.map((r) => r.gameId)).size !== rows.length)
    throw new Error("Duplicate appearance");
  const sorted = [...rows].sort(
    (a, b) =>
      b.playedOn.localeCompare(a.playedOn) ||
      b.order - a.order ||
      b.gameId.localeCompare(a.gameId),
  );
  const summarize = (
    selected: readonly Appearance[],
    requested: number | null,
  ) => ({
    ...battingStats(
      selected.map((r) => r.counts),
      minPA,
    ),
    requested,
    windowComplete: requested === null || selected.length >= requested,
    provenance: selected.map(
      ({ gameId, playedOn, order, inputRef, sourceId, asOf }) => ({
        gameId,
        playedOn,
        order,
        inputRef,
        sourceId,
        asOf,
      }),
    ),
  });
  return {
    season: summarize(sorted, null),
    recent: Object.fromEntries(
      [3, 5, 10, 20].map((n) => [n, summarize(sorted.slice(0, n), n)]),
    ),
  };
}
export function formatMetric(metric: Metric): string {
  if (metric.value === null) return "N/A";
  return metric.unit === "percent"
    ? `${(metric.value * 100).toFixed(1)}%`
    : metric.unit === "count"
      ? String(metric.value)
      : metric.value.toFixed(3);
}
