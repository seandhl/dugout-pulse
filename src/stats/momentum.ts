/** DEMO momentum v0.1. Pure functions; no clocks, I/O, rounding or public DTOs. */
import { battingStats, type Counts } from "./batting";
import {
  pitchingStats,
  type PitchingCounts,
  type WalkDefinition,
} from "./pitching";

export type Role = "hitter" | "starting_pitcher" | "relief_pitcher";
export type Scope = {
  leagueId: string;
  season: number;
  competition: "regular" | "postseason";
  role: Role;
};
export type Row = Scope & {
  playerId: string;
  gameId: string;
  playedOn: string;
  doubleheaderNo: number;
  releaseId: string;
  status: "FINAL" | "SCHEDULED";
  completedAt: string;
  asOf: string;
  revision: number;
  sourceId: string;
  inputRef: string;
  counts: Counts & PitchingCounts;
  walkDefinition?: WalkDefinition;
};
export type Input = Scope & {
  window?: 3 | 5 | 10 | 20;
  playerId: string;
  cutoffAt: string;
  releaseId: string;
  demo: true;
  rights: "demo_allowed";
  revisionsResolved: boolean;
  coverageComplete: boolean;
  lastAppearanceDate: string | null;
  roster: {
    status: "registered" | "unregistered" | "unknown";
    asOf: string;
    sourceId: string;
    reason?: string;
  };
  rows: readonly Row[];
};
export const MODEL = "momentum_v0_1_0";
export const CONFIG_ID = "momentum_config_v0_1_0";
const policies = {
  hitter: {
    n: 10,
    min: [3, 12, 0],
    medium: [0, 30, 0],
    high: [0, 60, 0],
    personal: [10, 40, 0],
    tau: [40, 0],
    cohort: 20,
    stale: 14,
    rest: 3,
  },
  starting_pitcher: {
    n: 5,
    min: [2, 30, 18],
    medium: [0, 75, 45],
    high: [0, 150, 90],
    personal: [3, 75, 45],
    tau: [100, 60],
    cohort: 10,
    stale: 21,
    rest: 7,
  },
  relief_pitcher: {
    n: 10,
    min: [3, 12, 6],
    medium: [0, 30, 18],
    high: [0, 60, 36],
    personal: [10, 40, 24],
    tau: [40, 24],
    cohort: 15,
    stale: 14,
    rest: 3,
  },
} as const;
const features = {
  hitter: [
    { id: "OBP", direction: 1, weight: 0.4, floor: 0.02 },
    { id: "ISO", direction: 1, weight: 0.35, floor: 0.02 },
    { id: "KRate", direction: -1, weight: 0.25, floor: 0.02 },
  ],
  starting_pitcher: [
    { id: "KMinusBB", direction: 1, weight: 0.45, floor: 0.02 },
    { id: "WHIP", direction: -1, weight: 0.35, floor: 0.1 },
    { id: "OutsPerStart", direction: 1, weight: 0.2, floor: 1 },
  ],
  relief_pitcher: [
    { id: "KMinusBB", direction: 1, weight: 0.5, floor: 0.02 },
    { id: "WHIP", direction: -1, weight: 0.3, floor: 0.1 },
    { id: "HRRate", direction: -1, weight: 0.2, floor: 0.01 },
  ],
} as const;
export type FeatureId = (typeof features)[Role][number]["id"];
type Metric = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  reason: string | null;
};
export type Reason =
  | "invalid_input"
  | "rights_denied"
  | "no_appearances"
  | "missing_data"
  | "inactive"
  | "insufficient_sample"
  | "baseline_unavailable";
const numeric = (x: number) => Number.isFinite(x);
const ascii = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const order = (a: Row, b: Row) =>
  ascii(a.playedOn, b.playedOn) ||
  a.doubleheaderNo - b.doubleheaderNo ||
  ascii(a.gameId, b.gameId);
const sameScope = (a: Scope, b: Scope) =>
  a.leagueId === b.leagueId &&
  a.season === b.season &&
  a.competition === b.competition &&
  a.role === b.role;
const day = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const t = Date.parse(`${s}T00:00:00Z`);
  return numeric(t) && new Date(t).toISOString().slice(0, 10) === s
    ? t / 86400000
    : NaN;
};
const timestamp = (s: string) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  numeric(day(s.slice(0, 10))) &&
  numeric(Date.parse(s));
const kstDate = (t: string) =>
  new Date(Date.parse(t) + 9 * 3600000).toISOString().slice(0, 10);

export function median(values: readonly number[]): number | null {
  if (!values.length || values.some((x) => !numeric(x))) return null;
  const a = [...values].sort((x, y) => x - y),
    i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : a[i - 1] / 2 + a[i] / 2;
}
/** Invalid values are unavailable, never silently zero/imputed. Zero MAD uses a positive floor. */
export function robustNormalize(
  value: number,
  center: number,
  scale: number,
  direction = 1,
  clip = 3,
): number | null {
  if (
    ![value, center, scale, direction, clip].every(numeric) ||
    scale <= 0 ||
    clip <= 0 ||
    ![1, -1].includes(direction)
  )
    return null;
  // A finite subtraction can overflow. Its sign still gives the correct clipped result.
  const difference = value - center;
  const z =
    direction *
    (numeric(difference) ? difference / scale : value / scale - center / scale);
  return Math.max(-clip, Math.min(clip, z));
}
export function shrinkage(n: number, tau: number): number | null {
  if (!numeric(n) || !numeric(tau) || n < 0 || tau <= 0) return null;
  return n === 0 ? 0 : 1 / (1 + tau / n);
}
function summarize(rows: readonly Row[], role: Role) {
  const metric = (
    numerator: number | null,
    denominator: number | null,
  ): Metric => ({
    numerator,
    denominator,
    value:
      numerator === null || denominator === null || denominator === 0
        ? null
        : numerator / denominator,
    reason:
      numerator === null || denominator === null
        ? "missing_fields"
        : denominator === 0
          ? "zero_denominator"
          : null,
  });
  if (role === "hitter") {
    const s = battingStats(rows.map((r) => r.counts));
    const t = s.totals;
    return {
      appearances: rows.length,
      opportunities: t.pa,
      outs: null as number | null,
      totals: t,
      metrics: {
        OBP: s.metrics.obp,
        ISO: metric(
          t.h === null ||
            t.doubles === null ||
            t.triples === null ||
            t.hr === null
            ? null
            : t.doubles + 2 * t.triples + 3 * t.hr,
          t.ab,
        ),
        KRate: s.metrics.kPct,
      } as Partial<Record<FeatureId, Metric>>,
    };
  }
  const s = pitchingStats(
    rows.map((r) => ({ counts: r.counts, walkDefinition: r.walkDefinition! })),
  );
  return {
    appearances: rows.length,
    opportunities: s.totals.bf,
    outs: s.totals.outsRecorded,
    totals: s.totals,
    metrics: {
      KMinusBB: s.metrics.kMinusBbPct,
      WHIP: s.metrics.whip,
      OutsPerStart: metric(s.totals.outsRecorded, rows.length),
      HRRate: metric(s.totals.hr, s.totals.bf),
    } as Partial<Record<FeatureId, Metric>>,
  };
}
type Summary = ReturnType<typeof summarize>;
const meets = (s: Summary, t: readonly number[]) =>
  s.appearances >= t[0] &&
  s.opportunities !== null &&
  s.opportunities >= t[1] &&
  (t[2] === 0 || (s.outs !== null && s.outs >= t[2]));
function reliability(s: Summary, role: Role) {
  const p = policies[role];
  return role === "hitter"
    ? shrinkage(s.opportunities!, p.tau[0])!
    : Math.min(
        shrinkage(s.opportunities!, p.tau[0])!,
        shrinkage(s.outs!, p.tau[1])!,
      );
}
/** S and W are disjoint. V intentionally overlaps W, as specified in v0.1. */
export function splitWindows(
  rows: readonly Row[],
  role: Role,
  window?: 3 | 5 | 10 | 20,
) {
  if (
    rows.some(
      (r) =>
        r.role !== role ||
        (rows[0] &&
          (!sameScope(r, rows[0]) ||
            r.playerId !== rows[0].playerId ||
            r.releaseId !== rows[0].releaseId)),
    )
  )
    throw Error("splitWindows requires one player/scope/release");
  const sorted = [...rows].sort(order),
    n = window ?? policies[role].n;
  return {
    W: sorted.slice(-n),
    V: sorted.slice(0, -1).slice(-n),
    S: sorted.slice(0, Math.max(0, sorted.length - n)),
    requested: n,
  };
}
function validate(input: Input, rowsValidated = false): void {
  if (
    !input ||
    (input.window !== undefined && ![3, 5, 10, 20].includes(input.window)) ||
    !(input.role in policies) ||
    !input.leagueId ||
    !input.playerId ||
    !input.releaseId ||
    !Number.isSafeInteger(input.season) ||
    input.season < 1900 ||
    !["regular", "postseason"].includes(input.competition) ||
    !timestamp(input.cutoffAt) ||
    !input.revisionsResolved ||
    typeof input.coverageComplete !== "boolean" ||
    !Array.isArray(input.rows)
  )
    throw Error("Invalid scope/release/coverage");
  if (
    !input.roster ||
    !["registered", "unregistered", "unknown"].includes(input.roster.status) ||
    !input.roster.sourceId ||
    !timestamp(input.roster.asOf) ||
    Date.parse(input.roster.asOf) > Date.parse(input.cutoffAt)
  )
    throw Error("Invalid roster provenance");
  if (
    input.lastAppearanceDate !== null &&
    !numeric(day(input.lastAppearanceDate))
  )
    throw Error("Invalid last appearance date");
  if (rowsValidated) return;
  const seen = new Set<string>();
  for (const r of input.rows) {
    if (
      !r ||
      !(r.role in policies) ||
      !["regular", "postseason"].includes(r.competition) ||
      !Number.isSafeInteger(r.season) ||
      !r.leagueId ||
      !r.playerId ||
      !/^[\x21-\x7e]+$/.test(r.gameId) ||
      !numeric(day(r.playedOn)) ||
      !Number.isSafeInteger(r.doubleheaderNo) ||
      r.doubleheaderNo < 1 ||
      !["FINAL", "SCHEDULED"].includes(r.status) ||
      !Number.isSafeInteger(r.revision) ||
      r.revision < 1 ||
      !r.sourceId ||
      !r.inputRef ||
      !r.releaseId ||
      !timestamp(r.asOf) ||
      !timestamp(r.completedAt)
    )
      throw Error("Invalid row metadata");
    if (r.role === "hitter") battingStats([r.counts]);
    else
      pitchingStats([{ counts: r.counts, walkDefinition: r.walkDefinition! }]);
    if (
      r.releaseId === input.releaseId &&
      r.status === "FINAL" &&
      Date.parse(r.asOf) <= Date.parse(input.cutoffAt) &&
      Date.parse(r.completedAt) <= Date.parse(input.cutoffAt)
    ) {
      if (day(r.playedOn) > day(kstDate(input.cutoffAt)))
        throw Error("Future appearance date");
      // Same pitcher cannot be starter and reliever in the same game.
      const key = JSON.stringify([
        r.leagueId,
        r.season,
        r.competition,
        r.playerId,
        r.role === "hitter" ? "bat" : "pitch",
        r.gameId,
      ]);
      if (seen.has(key))
        throw Error("Duplicate/unresolved revision or mixed pitching role");
      seen.add(key);
    }
  }
}
function eligibleRows(input: Input) {
  return input.rows.filter(
    (r) =>
      sameScope(r, input) &&
      r.releaseId === input.releaseId &&
      r.status === "FINAL" &&
      Date.parse(r.asOf) <= Date.parse(input.cutoffAt) &&
      Date.parse(r.completedAt) <= Date.parse(input.cutoffAt),
  );
}
function baseline(rows: readonly Row[], input: Input, boundary: Row) {
  const grouped = new Map<string, Row[]>();
  for (const r of rows)
    if (r.playerId !== input.playerId && order(r, boundary) < 0) {
      const group = grouped.get(r.playerId);
      if (group) group.push(r);
      else grouped.set(r.playerId, [r]);
    }
  const candidates = [...grouped]
    .sort(([a], [b]) => ascii(a, b))
    .map(([playerId, rows]) => ({
      playerId,
      rows: [...rows].sort(order),
      summary: summarize(rows, input.role),
    }));
  return features[input.role].map((f) => {
    const included = candidates.filter(
      (c) =>
        meets(c.summary, policies[input.role].personal) &&
        c.summary.metrics[f.id]?.value != null,
    );
    const values = included.map((c) => c.summary.metrics[f.id]!.value!);
    const m = median(values),
      mad = m === null ? null : median(values.map((v) => Math.abs(v - m)));
    return {
      ...f,
      available: included.length >= policies[input.role].cohort,
      count: included.length,
      median: m,
      mad,
      scale: mad === null ? null : Math.max(1.4826 * mad, f.floor),
      included: included.map((c) => ({
        playerId: c.playerId,
        rows: c.rows,
        value: c.summary.metrics[f.id]!.value!,
      })),
      excludedPlayerIds: candidates
        .filter((c) => !included.includes(c))
        .map((c) => c.playerId),
    };
  });
}
/** Snapshot of fixed, versioned policy. Returned copies cannot change subsequent calculations. */
export function momentumConfig(role: Role) {
  const p = policies[role];
  return {
    model: MODEL,
    configId: CONFIG_ID,
    codeVersion: "momentum_ts_v0_1_0",
    featureDefinitionVersion: "momentum_features_v0_1_0",
    role,
    n: p.n,
    min: [...p.min],
    medium: [...p.medium],
    high: [...p.high],
    personal: [...p.personal],
    tau: [...p.tau],
    cohort: p.cohort,
    stale: p.stale,
    rest: p.rest,
    features: features[role].map((f) => ({ ...f })),
    componentWeights: { level: 0.55, seasonChange: 0.3, previousChange: 0.15 },
    minFeatures: 2,
    minFeatureWeight: 0.6,
    temperature: 1,
    zClip: 3,
    madMultiplier: 1.4826,
    numericTolerance: 1e-12,
    explanationTopK: 3,
  };
}
// Stable non-cryptographic replay identifier; never an integrity/authentication check.
function fingerprint(value: unknown): string {
  const canonical = (x: unknown): string => {
    if (x === undefined) return "undefined";
    if (x === null || typeof x !== "object") return JSON.stringify(x);
    if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
    const o = x as Record<string, unknown>;
    return (
      "{" +
      Object.keys(o)
        .sort(ascii)
        .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
        .join(",") +
      "}"
    );
  };
  let h = 2166136261;
  for (const c of canonical(value))
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return "fnv1a32:" + h.toString(16).padStart(8, "0");
}
/** Independent baseline extraction, with the identical scope/cutoff/leave-one-out policy. */
export function extractMomentumBaseline(input: Input) {
  if (input?.rights !== "demo_allowed" || input?.demo !== true)
    return { status: "rights_denied" as const, artifact: null };
  try {
    validate(input);
    const pool = eligibleRows(input);
    const windows = splitWindows(
      pool.filter((r) => r.playerId === input.playerId),
      input.role,
      input.window,
    );
    if (!windows.W.length)
      return { status: "no_appearances" as const, artifact: null };
    const boundary = windows.W[0];
    const artifact = {
      leagueId: input.leagueId,
      season: input.season,
      competition: input.competition,
      role: input.role,
      releaseId: input.releaseId,
      boundary,
      config: momentumConfig(input.role),
      features: baseline(pool, input, boundary),
    };
    return {
      status: "ready" as const,
      artifact,
      artifactHash: fingerprint(artifact),
    };
  } catch {
    return { status: "invalid_input" as const, artifact: null };
  }
}

const batchToken = Symbol("validated private batch");
/** Snapshot-owned rows; validation is reused only for identical release/cutoff.
 * Input metadata and roster provenance are still checked for every player. */
export function createMomentumBatchScorer(rows: readonly Row[]) {
  const owned = structuredClone(rows);
  for (const row of owned) {
    Object.freeze(row.counts);
    Object.freeze(row);
  }
  Object.freeze(owned);
  const validated = new Set<string>();
  return (
    input: Omit<Input, "rows">,
    options: { includeInputHash?: boolean } = {},
  ) => {
    const full = { ...input, rows: owned };
    const key = JSON.stringify([input.releaseId, input.cutoffAt]);
    if (!validated.has(key)) {
      try {
        validate(full);
        validated.add(key);
      } catch {
        return scoreMomentum(full, options);
      }
    }
    return scoreMomentum(full, options, batchToken);
  };
}
export function scoreMomentum(
  input: Input,
  options: { includeInputHash?: boolean } = {},
  trustedBatch?: symbol,
) {
  const flags: string[] = ["demo"];
  const withheld = <T = null>(
    status: Reason,
    explanation: T | null = null,
  ) => ({
    status,
    rawScore: null,
    previousValue: null,
    delta: null,
    confidence: null,
    eligibility: { eligible: false, reason: status },
    flags: [...flags],
    explanation,
    model: MODEL,
    configId: CONFIG_ID,
  });
  if (input?.rights !== "demo_allowed" || input?.demo !== true)
    return withheld("rights_denied");
  try {
    validate(input, trustedBatch === batchToken);
  } catch {
    return withheld("invalid_input");
  }
  try {
    const pool = eligibleRows(input),
      appearances = pool.filter((r) => r.playerId === input.playerId);
    if (!appearances.length) return withheld("no_appearances");
    const windows = splitWindows(appearances, input.role, input.window),
      p = policies[input.role];
    const W = summarize(windows.W, input.role),
      V = summarize(windows.V, input.role),
      S = summarize(windows.S, input.role);
    const last = windows.W.at(-1)!.playedOn;
    const daysSinceLastAppearance = day(kstDate(input.cutoffAt)) - day(last);
    if (appearances.some((r) => r.revision > 1)) flags.push("record_corrected");
    if (
      input.role !== "hitter" &&
      input.rows.some(
        (r) =>
          r.playerId === input.playerId &&
          r.leagueId === input.leagueId &&
          r.releaseId === input.releaseId &&
          r.status === "FINAL" &&
          Date.parse(r.asOf) <= Date.parse(input.cutoffAt) &&
          Date.parse(r.completedAt) <= Date.parse(input.cutoffAt) &&
          r.role !== "hitter" &&
          r.role !== input.role &&
          r.season === input.season &&
          r.competition === input.competition,
      )
    )
      flags.push("role_changed");
    if (input.roster.status !== "registered")
      flags.push(`roster_${input.roster.status}`);
    const config =
      input.window === undefined
        ? momentumConfig(input.role)
        : { ...momentumConfig(input.role), n: input.window };
    const context = {
      config,
      configHash: fingerprint(config),
      inputHash:
        options.includeInputHash === false
          ? null
          : fingerprint({
              ...input,
              rows: [...input.rows].sort(
                (a, b) =>
                  ascii(a.playerId, b.playerId) ||
                  order(a, b) ||
                  ascii(a.role, b.role) ||
                  a.revision - b.revision,
              ),
            }),
      scope: {
        leagueId: input.leagueId,
        season: input.season,
        competition: input.competition,
        role: input.role,
      },
      playerId: input.playerId,
      cutoffAt: input.cutoffAt,
      releaseId: input.releaseId,
      roster: input.roster,
      lastAppearanceDate: last,
      daysSinceLastAppearance,
      windows,
      summaries: { W, V, S },
      windowComplete: W.appearances === (input.window ?? p.n),
    };
    if (W.appearances < (input.window ?? p.n)) flags.push("window_incomplete");
    if (
      input.role === "hitter" &&
      battingStats(windows.W.map((r) => r.counts)).paValidation ===
        "unverifiable"
    )
      flags.push("pa_unverifiable");
    if (
      !input.coverageComplete ||
      input.lastAppearanceDate === null ||
      W.opportunities === null ||
      (input.role !== "hitter" && W.outs === null)
    )
      return withheld("missing_data", context);
    if (last !== input.lastAppearanceDate)
      return withheld("invalid_input", context);
    if (daysSinceLastAppearance > p.rest) flags.push("rest_gap");
    if (daysSinceLastAppearance > p.stale) {
      flags.push("inactive");
      return withheld("inactive", context);
    }
    if (!meets(W, p.min)) return withheld("insufficient_sample", context);
    const B = baseline(pool, input, windows.W[0]);
    const exclusions = B.flatMap((b) => {
      const reasons: string[] = [];
      if (W.metrics[b.id]?.value == null)
        reasons.push(W.metrics[b.id]?.reason ?? "missing_fields");
      if (!b.available) reasons.push("baseline_insufficient");
      return reasons.length ? [{ id: b.id, reasons }] : [];
    });
    if (exclusions.some((e) => e.reasons.includes("baseline_insufficient")))
      flags.push("baseline_insufficient");
    if (
      exclusions.some((e) =>
        e.reasons.some((r) => r !== "baseline_insufficient"),
      )
    )
      flags.push("missing_feature");
    const F = B.filter((b) => !exclusions.some((e) => e.id === b.id)),
      weightSum = F.reduce((s, f) => s + f.weight, 0);
    const baseContext = {
      ...context,
      baseline: B,
      boundary: windows.W[0],
      exclusions,
    };
    if (F.length < 2 || weightSum < 0.6)
      return withheld(
        flags.includes("baseline_insufficient")
          ? "baseline_unavailable"
          : "missing_data",
        baseContext,
      );
    if (exclusions.length) flags.push("weights_redistributed");
    const previousUsable =
      meets(V, p.min) && F.every((f) => V.metrics[f.id]?.value != null);
    if (!previousUsable) flags.push("previous_window_unavailable");
    const rW = reliability(W, input.role),
      rV = previousUsable ? reliability(V, input.role) : null;
    const terms = F.map((f) => {
      const personalOK = meets(S, p.personal) && S.metrics[f.id]?.value != null;
      if (!personalOK && !flags.includes("personal_baseline_fallback"))
        flags.push("personal_baseline_fallback");
      const b = personalOK ? S.metrics[f.id]!.value! : f.median!,
        rS = personalOK ? reliability(S, input.role) : 0;
      const w = f.weight / weightSum,
        current = W.metrics[f.id]!.value!,
        previous = previousUsable ? V.metrics[f.id]!.value! : null;
      const normalized = (x: number, y: number) =>
        robustNormalize(x, y, f.scale!, f.direction)!;
      const L = normalized(current, f.median!),
        C = rS * normalized(current, b),
        P =
          previous === null
            ? 0
            : Math.min(rW, rV!) * normalized(current, previous);
      const q = 0.55 * L + 0.3 * C + 0.15 * P;
      const previousQ =
        previous === null
          ? null
          : 0.55 * normalized(previous, f.median!) +
            0.3 * rS * normalized(previous, b);
      return {
        ...f,
        current,
        previous,
        personalBaseline: b,
        rS,
        weight: w,
        originalWeight: f.weight,
        L,
        C,
        P,
        q,
        contribution: w * q,
        previousQ,
        unclipped: {
          L: (f.direction * (current - f.median!)) / f.scale!,
          C: (f.direction * (current - b)) / f.scale!,
          P:
            previous === null
              ? null
              : (f.direction * (current - previous)) / f.scale!,
        },
      };
    });
    const z = terms.reduce((s, f) => s + f.contribution, 0),
      u = rW * z;
    const rawScore = 100 / (1 + Math.exp(-u));
    const previousValue = previousUsable
      ? 100 /
        (1 +
          Math.exp(
            -rV! * terms.reduce((s, f) => s + f.weight * f.previousQ!, 0),
          ))
      : null;
    const confidence = meets(W, p.high)
      ? "high"
      : meets(W, p.medium)
        ? "medium"
        : "low";
    if (confidence === "low") flags.push("small_sample_low");
    return {
      status: "ready" as const,
      rawScore,
      previousValue,
      delta: previousValue === null ? null : rawScore - previousValue,
      confidence,
      eligibility: { eligible: true, reason: null },
      model: MODEL,
      configId: CONFIG_ID,
      flags,
      explanation: {
        ...baseContext,
        terms,
        reasons: terms.map((t) => ({
          feature: t.id,
          direction:
            t.contribution > 0
              ? "가점 방향"
              : t.contribution < 0
                ? "감점 방향"
                : "중립 기여",
          text: `${t.id} 최근 ${t.current}, 동일 시즌·대회·역할 기준 ${t.median}; 기회 ${W.opportunities}${input.role === "hitter" ? " PA" : " BF"}, ${input.role === "hitter" ? "" : `${W.outs}아웃. `}표본 수축 계수 ${rW}`,
        })),
        effectiveOpportunity: {
          unit: input.role === "hitter" ? "PA" : "BF_and_outs",
          count: W.opportunities,
          outs: input.role === "hitter" ? null : W.outs,
          tau: [...p.tau],
          reliability: rW,
        },
        topContributions: [...terms]
          .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
          .slice(0, 3)
          .map((t) => t.id),
        rW,
        rV,
        z,
        u,
        temperature: 1,
        previousUsable,
        previousOverlapsS: windows.V.some((v) =>
          windows.S.some((s) => s.gameId === v.gameId),
        ),
      },
    };
  } catch {
    return withheld("invalid_input");
  }
}

/** Reviewable internal result only. Public API remains model_pending. */
export function calculateMomentum(input: Input) {
  const result = scoreMomentum(input);
  const context = result.explanation;
  const n =
    context && "summaries" in context
      ? {
          appearances: context.summaries.W.appearances,
          opportunities: context.summaries.W.opportunities,
          outs: context.summaries.W.outs,
        }
      : null;
  const common = {
    algorithmVersion: MODEL,
    sourceMode: "demo" as const,
    asOf: input?.cutoffAt ?? null,
    scope: {
      leagueId: input?.leagueId,
      season: input?.season,
      competition: input?.competition,
      role: input?.role,
    },
    warnings: [...result.flags],
    confidence: result.confidence,
    n,
    disclaimer:
      "DEMO · 최근 기록의 기술 요약이며 승패나 미래 경기 결과의 예측 확률이 아닙니다.",
  };
  if (result.status !== "ready") {
    const reason =
      result.status === "rights_denied"
        ? "data_not_licensed"
        : result.status === "baseline_unavailable"
          ? "invalid_baseline"
          : ["missing_data", "no_appearances", "insufficient_sample"].includes(
                result.status,
              )
            ? "insufficient_data"
            : result.status;
    return {
      ...common,
      status: "withheld" as const,
      reason,
      detailReason: result.status,
      score: null,
      rawScore: null,
      label: null,
      reasons: [],
      audit: result,
    };
  }
  // Classify the unrounded value, so rounding never changes the label.
  const label =
    result.rawScore >= 60
      ? ("상승" as const)
      : result.rawScore <= 40
        ? ("하락" as const)
        : ("보통" as const);
  return {
    ...common,
    status: "ready" as const,
    reason: null,
    detailReason: null,
    score: Math.floor(result.rawScore * 10 + 0.5) / 10,
    rawScore: result.rawScore,
    label,
    reasons: result.explanation.reasons.slice(0, 3),
    audit: result,
  };
}
