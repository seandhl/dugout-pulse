import { demoRights } from "../ingest/pipeline";
import type { PipelineState } from "../ingest/pipeline";
export type Alert = { code: string; count: number; action: string };
export interface AlertAdapter {
  emit(alert: Alert): void | Promise<void>;
}
export async function dispatch(alerts: Alert[], adapter: AlertAdapter) {
  for (const alert of alerts) await adapter.emit(alert);
}
function nested(value: unknown, ...keys: string[]): unknown {
  for (const key of keys) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function inspect(state: PipelineState, now = Date.now()) {
  const alerts: Alert[] = [];
  const add = (code: string, count: number, action: string) => {
    if (count) alerts.push({ code, count, action });
  };
  const records = Object.values(state.records);
  let negative = 0,
    hits = 0,
    extra = 0,
    bf = 0,
    missing = 0,
    duplicates = 0;
  const seen = new Set<string>();
  for (const { row: r, sourceId, kind } of records) {
    if (!sourceId?.trim()) missing++;
    if (
      Object.entries(r).some(
        ([k, v]) => !["season"].includes(k) && typeof v === "number" && v < 0,
      )
    )
      negative++;
    if (typeof r.h === "number" && typeof r.ab === "number" && r.h > r.ab)
      hits++;
    if (
      typeof r.h === "number" &&
      Number(r.doubles ?? 0) + Number(r.triples ?? 0) + Number(r.hr ?? 0) > r.h
    )
      extra++;
    // A review heuristic: double/triple plays and non-batter outs can explain this.
    if (typeof r.bf === "number" && typeof r.outs === "number" && r.bf < r.outs)
      bf++;
    if (kind === "games") {
      const key = JSON.stringify([
        r.season,
        r.competition,
        r.played_on,
        r.home_team_id,
        r.away_team_id,
        r.doubleheader_no ?? 1,
      ]);
      if (seen.has(key)) duplicates++;
      seen.add(key);
    }
  }
  const repair =
    "게시 중단 → 해당 시즌·대회 원천과 검증 보고서 확인 → 정정 fixture 검증·게시 또는 최신 게시 롤백";
  for (const [code, n] of [
    ["NEGATIVE_RECORD", negative],
    ["H_GT_AB", hits],
    ["EXTRA_BASE_GT_H", extra],
    ["BF_OUTS_REVIEW", bf],
    ["MISSING_SOURCE", missing],
    ["DUPLICATE_GAME", duplicates],
  ] as const)
    add(code, n, repair);
  const scopes = [
    ...new Set(
      records.map((r) => JSON.stringify([r.row.season, r.row.competition])),
    ),
  ];
  const datasets = scopes.map((key) => {
    const [season, competition] = JSON.parse(key) as [number, string];
    const rows = records.filter(
      (r) => r.row.season === season && r.row.competition === competition,
    );
    const lastUpdated =
      rows
        .map((r) => String(r.row.as_of ?? ""))
        .sort()
        .at(-1) || null;
    const latestGameDate =
      rows
        .filter((r) => r.kind === "games" && r.row.status === "FINAL")
        .map((r) => String(r.row.played_on))
        .sort()
        .at(-1) ?? null;
    const stale =
      !lastUpdated ||
      !Number.isFinite(Date.parse(lastUpdated)) ||
      now - Date.parse(lastUpdated) > 48 * 3600000;
    add(
      "DATASET_STALE",
      Number(stale),
      "48시간 기준 초과: 시즌·대회와 비시즌 여부 확인, 공급/게시 실행 이력 확인 후 승인된 DEMO 파일 재검증",
    );
    return {
      season,
      competition,
      sourceMode: "DEMO",
      licenseStatus: rows.every(
        (r) =>
          r.sourceId === demoRights.sourceId &&
          r.licenseId === demoRights.licenseId &&
          demoRights.seasons.some((s) => s === season) &&
          demoRights.competitions.some((c) => c === competition),
      )
        ? "APPROVED_DEMO_ONLY"
        : "UNVERIFIED",
      lastUpdated,
      latestGameDate,
      sampleSize: rows.length,
      finalGames: rows.filter(
        (r) => r.kind === "games" && r.row.status === "FINAL",
      ).length,
      seasonCompleteness: null,
      completenessReason: "승인된 시즌 전체 경기 분모 없음",
      sourceIds: [...new Set(rows.map((r) => r.sourceId))],
    };
  });
  add(
    "LICENSE_UNVERIFIED",
    datasets.filter((d) => d.licenseStatus === "UNVERIFIED").length,
    "출처·라이선스·시즌·대회 범위를 확인하고 복구 전 공개 중단",
  );
  add(
    "DATASET_EMPTY",
    Number(!datasets.length),
    "DEMO 파일을 검증·게시하고 공개 경로 확인",
  );
  const current = (state.momentumCurrent ?? [])
    .map((id) => state.momentumSnapshots?.[id])
    .filter((s) => !!s);
  const groups = [
    ...new Set(
      current.map((s) =>
        JSON.stringify([
          s.season,
          s.competition,
          s.role,
          s.window,
          s.algorithmVersion,
        ]),
      ),
    ),
  ];
  const scores = groups.map((key) => {
    const group = current.filter(
      (s) =>
        JSON.stringify([
          s.season,
          s.competition,
          s.role,
          s.window,
          s.algorithmVersion,
        ]) === key,
    );
    const baselineRevision = Math.max(
      -1,
      ...Object.values(state.momentumSnapshots ?? {})
        .filter(
          (s) =>
            !state.momentumCurrent?.includes(s.id) &&
            s.publicationRevision <
              Math.min(...group.map((item) => item.publicationRevision)) &&
            JSON.stringify([
              s.season,
              s.competition,
              s.role,
              s.window,
              s.algorithmVersion,
            ]) === key,
        )
        .map((s) => s.publicationRevision),
    );
    const baseline = Object.values(state.momentumSnapshots ?? {}).filter(
      (s) =>
        s.publicationRevision === baselineRevision &&
        JSON.stringify([
          s.season,
          s.competition,
          s.role,
          s.window,
          s.algorithmVersion,
        ]) === key,
    );
    const summary = (items: typeof group) => {
      const values = items
        .map((s) => s.score)
        .filter((v): v is number => v !== null && Number.isFinite(v));
      return {
        n: items.length,
        missing:
          items.filter((s) => s.score === null).length / (items.length || 1),
        extreme:
          values.filter((v) => v === 0 || v === 100).length /
          (values.length || 1),
        mean: values.reduce((a, b) => a + b, 0) / (values.length || 1),
        histogram: Array.from(
          { length: 5 },
          (_, i) =>
            values.filter((v) => Math.min(4, Math.floor(v / 20)) === i).length /
            (values.length || 1),
        ),
      };
    };
    const a = summary(group),
      b = summary(baseline);
    add(
      "SCORE_NONFINITE",
      group.filter((s) => s.score !== null && !Number.isFinite(s.score)).length,
      repair,
    );
    add(
      "SCORE_RANGE",
      group.filter((s) => s.score !== null && (s.score < 0 || s.score > 100))
        .length,
      repair,
    );
    add(
      "ROLE_MIX",
      group.filter((s) => {
        const scope = nested(
          s.explanation,
          "calculation",
          "explanation",
          "scope",
        );
        const role = nested(scope, "role");
        const expected = {
          hitter: "hitter",
          starter: "starting_pitcher",
          reliever: "relief_pitcher",
        }[s.role];
        return (
          (role !== undefined && role !== expected) ||
          s.windowBasis !==
            {
              hitter: "최근 타격 출전 경기",
              starter: "최근 선발 등판",
              reliever: "최근 구원 등판",
            }[s.role]
        );
      }).length,
      "역할과 계산 windowBasis 확인 후 타자/선발/불펜을 분리하여 재계산",
    );
    if (a.n >= 20 && b.n >= 20) {
      add("SCORE_EXTREME_SURGE", Number(a.extreme - b.extreme >= 0.2), repair);
      add(
        "SCORE_UNCALCULATED_SURGE",
        Number(a.missing - b.missing >= 0.2),
        "표본 부족·결장·로스터 제외 사유와 필드 누락을 확인 후 재계산",
      );
      add(
        "SCORE_DISTRIBUTION_SHIFT",
        Number(
          a.histogram.reduce(
            (sum, v, i) => sum + Math.abs(v - b.histogram[i]),
            0,
          ) /
            2 >=
            0.4,
        ),
        repair,
      );
    }
    return {
      scope: JSON.parse(key) as unknown,
      current: a,
      baseline: b,
      comparisonAvailable: a.n >= 20 && b.n >= 20,
    };
  });
  const runs = (state.runs ?? []).map((run) => ({
    phase: run.phase,
    status: run.status,
    attemptedAt: run.attemptedAt,
    successfulAt: run.successfulAt,
    durationMs: run.durationMs ?? null,
    rowsImported:
      run.status === "PUBLISHED"
        ? (state.batches[run.batchId]?.report.sampleSize ?? 0)
        : 0,
    invalid: state.batches[run.batchId]?.report.counts.errors ?? 0,
    duplicates: state.batches[run.batchId]?.report.counts.duplicates ?? 0,
  }));
  add(
    "IMPORT_REJECTED",
    runs.filter((r) => r.status === "REJECTED").length,
    "검증 보고서 오류 행을 수정하고 재검증; 거부된 게시가 공개 반영되지 않았는지 확인",
  );
  return {
    observedAt: new Date(now).toISOString(),
    datasets,
    runs,
    lastSuccess:
      runs
        .map((r) => r.successfulAt)
        .filter((v): v is string => !!v)
        .sort()
        .at(-1) ?? null,
    scores,
    alerts,
  };
}
