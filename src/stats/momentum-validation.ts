/** Offline descriptive evaluation. Never trains or changes the production model. */
import {
  MODEL,
  momentumConfig,
  scoreMomentum,
  shrinkage,
  type Input,
} from "./momentum";

export function assertScoringVersion(versions: readonly string[]) {
  if (!versions.length || versions.some((v) => v !== MODEL))
    throw Error("Mixed or unsupported scoringVersion");
}
/** A game-end snapshot includes only records completed AND published by that instant.
 * The model applies a second cutoff gate to both features and cohort baseline. */
export function atCutoff(input: Input, cutoffAt: string): Input {
  const cutoff = Date.parse(cutoffAt);
  if (!Number.isFinite(cutoff)) throw Error("Invalid cutoff");
  if (Date.parse(input.roster.asOf) > cutoff) throw Error("Future roster");
  const rows = input.rows.filter(
    (r) =>
      r.status === "FINAL" &&
      Date.parse(r.completedAt) <= cutoff &&
      Date.parse(r.asOf) <= cutoff,
  );
  const own = rows.filter(
    (r) =>
      r.playerId === input.playerId &&
      r.role === input.role &&
      r.leagueId === input.leagueId &&
      r.season === input.season &&
      r.competition === input.competition &&
      r.releaseId === input.releaseId,
  );
  return {
    ...input,
    cutoffAt,
    rows,
    lastAppearanceDate:
      own
        .map((r) => r.playedOn)
        .sort()
        .at(-1) ?? null,
  };
}
export function distribution(values: number[]) {
  if (values.some((v) => !Number.isFinite(v))) throw Error("Nonfinite metric");
  const a = [...values].sort((x, y) => x - y);
  return {
    n: a.length,
    min: a[0] ?? null,
    median: a.length
      ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2
      : null,
    max: a.at(-1) ?? null,
    mean: a.length ? a.reduce((s, v) => s + v, 0) / a.length : null,
  };
}
export function evaluate(
  inputs: readonly Input[],
  versions: readonly string[],
) {
  assertScoringVersion(versions);
  if (inputs.length !== versions.length)
    throw Error("Version cardinality mismatch");
  return inputs.map((input) => {
    const result = scoreMomentum(atCutoff(input, input.cutoffAt));
    if (result.status !== "ready")
      return {
        role: input.role,
        playerId: input.playerId,
        cutoffAt: input.cutoffAt,
        scoringVersion: MODEL,
        status: result.status,
        score: null,
      };
    const e = result.explanation;
    const config = momentumConfig(input.role);
    // Recompute ALL reliability-dependent terms, including personal and previous windows.
    const sensitivity = [0.5, 1, 2].flatMap((tau) =>
      [0.75, 1, 1.5].flatMap((temp) =>
        [0.8, 1, 1.2].map((weight) => {
          const rel = (s: typeof e.summaries.W) =>
            input.role === "hitter"
              ? shrinkage(s.opportunities!, config.tau[0] * tau)!
              : Math.min(
                  shrinkage(s.opportunities!, config.tau[0] * tau)!,
                  shrinkage(s.outs!, config.tau[1] * tau)!,
                );
          const rw = rel(e.summaries.W),
            rv = rel(e.summaries.V),
            rs = rel(e.summaries.S);
          const ws = e.terms.map((t, i) => t.weight * (i === 0 ? weight : 1));
          const sum = ws.reduce((s, v) => s + v, 0);
          const z = e.terms.reduce(
            (s, t, i) =>
              s +
              (ws[i] / sum) *
                (0.55 * t.L +
                  0.3 * (t.rS === 0 ? 0 : (t.C / t.rS) * rs) +
                  0.15 *
                    (e.previousUsable
                      ? (t.P / Math.min(e.rW, e.rV!)) * Math.min(rw, rv)
                      : 0)),
            0,
          );
          const score = 100 / (1 + Math.exp((-rw * z) / temp));
          return {
            experimentId: `${MODEL}:sensitivity:tau=${tau}:temp=${temp}:firstWeight=${weight}`,
            tauMultiplier: tau,
            temperature: temp,
            firstFeatureWeightMultiplier: weight,
            score,
            change: score - result.rawScore,
          };
        }),
      ),
    );
    return {
      role: input.role,
      playerId: input.playerId,
      cutoffAt: input.cutoffAt,
      scoringVersion: MODEL,
      status: result.status,
      score: result.rawScore,
      confidence: result.confidence,
      reliability: e.rW,
      unshrunkScore: 100 / (1 + Math.exp(-e.z)),
      sensitivity,
      provenance: {
        releaseId: input.releaseId,
        season: input.season,
        competition: input.competition,
        sources: [...new Set(input.rows.map((r) => r.sourceId))],
        asOf: input.cutoffAt,
        sample: e.summaries.W,
        inputHash: e.inputHash,
        configHash: e.configHash,
      },
    };
  });
}
export function actualBacktestGate(manifest: unknown): never {
  const m = manifest as Record<string, unknown> | null;
  if (
    !m ||
    m.rightsApproved !== true ||
    typeof m.rightsEvidence !== "string" ||
    !m.rightsEvidence.trim()
  )
    throw Error("actual backtest not run: usage rights evidence required");
  if (
    m.coverageComplete !== true ||
    !Number.isSafeInteger(m.completedGames) ||
    (m.completedGames as number) < 100
  )
    throw Error(
      "actual backtest not run: sufficient historical logs required (100 game screening floor; not statistical validation)",
    );
  throw Error(
    "actual backtest not run: licensed point-in-time provider adapter not implemented; DEMO model cannot accept real data",
  );
}

/** Average tied rank; compare only common eligible players in one role/scope/version. */
export function rankingVolatility(
  before: { playerId: string; score: number }[],
  after: { playerId: string; score: number }[],
) {
  const ranks = (rows: typeof before) => {
    if (
      new Set(rows.map((r) => r.playerId)).size !== rows.length ||
      rows.some((r) => !Number.isFinite(r.score))
    )
      throw Error("Invalid ranking panel");
    return new Map(
      rows.map((r) => [
        r.playerId,
        1 +
          rows.filter((x) => x.score > r.score).length +
          (rows.filter((x) => x.score === r.score).length - 1) / 2,
      ]),
    );
  };
  const a = ranks(before),
    b = ranks(after);
  const changes = [...a].flatMap(([id, rank]) =>
    b.has(id) ? [Math.abs(rank - b.get(id)!)] : [],
  );
  return {
    commonPlayers: changes.length,
    entered: after.filter((r) => !a.has(r.playerId)).length,
    exited: before.filter((r) => !b.has(r.playerId)).length,
    absoluteRankChange: distribution(changes),
  };
}
