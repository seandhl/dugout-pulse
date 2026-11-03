"use client";
import { releaseFetch } from "@/components/release-provider";
import { useEffect, useState } from "react";
import Link from "@/components/release-provider";
import { useReleaseRouter } from "@/components/release-provider";
import { useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import type { PitcherDetail } from "@/server/reads/pitcher-detail";
import { formatMetric } from "@/stats/batting";
import { DataTable } from "@/components/ui";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/skeleton";
const GameAnalysis = dynamic(
  () => import("./game-analysis").then((m) => m.GameAnalysis),
  {
    loading: () => <Skeleton />,
  },
);
import { DetailHeader, DetailFooter } from "./detail-shared";
export function PitcherDetailView({
  id,
  defaultRole,
}: {
  id: string;
  defaultRole: "starter" | "reliever";
}) {
  const params = new URLSearchParams(useSearchParams());
  params.delete("releaseId");
  const role = params.get("role") ?? defaultRole;
  const window = params.get("window") ?? (role === "starter" ? "5" : "10");
  return (
    <PitcherContent key={`${id}/${role}/${window}`} {...{ id, role, window }} />
  );
}
function PitcherContent({
  id,
  role,
  window,
}: {
  id: string;
  role: string;
  window: string;
}) {
  const router = useReleaseRouter();
  const [data, setData] = useState<PitcherDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    releaseFetch(
      `/api/v1/players/${encodeURIComponent(id)}/pitching?role=${encodeURIComponent(role)}&window=${encodeURIComponent(window)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "연결 오류");
      });
    return () => controller.abort();
  }, [id, role, window, retry]);
  if (error)
    return (
      <section role="alert" className="panel">
        <h1>상세 데이터를 불러오지 못했습니다</h1>
        <p>{error} · 오프라인이면 연결을 확인하세요.</p>
        <button
          onClick={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          다시 시도
        </button>
        <Link href="/players">선수 목록</Link>
      </section>
    );
  if (!data) return <p role="status">투수 상세를 불러오는 중…</p>;
  const d = data,
    label = role === "starter" ? "선발" : "불펜";
  const metrics =
    role === "starter"
      ? (["era", "whip", "kPer9", "bbPer9", "kMinusBbPct"] as const)
      : (["kMinusBbPct", "whip", "era"] as const);
  const labels = {
    era: "ERA",
    whip: "WHIP",
    kPer9: "K/9",
    bbPer9: "BB/9",
    kMinusBbPct: "K-BB%",
  };
  const summary = (s: PitcherDetail["recent"]) =>
    `${s.sample.appearances}등판 · ${s.totals.outsRecorded ?? "N/A"} outs / ${s.inningsDisplay} IP · ${s.sample.bf ?? "N/A"} BF`;
  return (
    <>
      <DetailHeader d={d} id={id} roleLabel={label} />
      <aside className="ds-notice" aria-label="투구 기록 해석 안내">
        ERA는 적은 이닝에서 자책점 하나로 크게 흔들립니다. 신뢰도는 표본
        등급이며 예측 확률이 아닙니다. 휴식·결장·현재 엔트리 여부는
        미확인입니다.
      </aside>
      <label>
        기록 역할{" "}
        <select
          value={role}
          onChange={(e) =>
            router.replace(
              `?role=${e.target.value}&window=${e.target.value === "starter" ? "5" : "10"}`,
              { scroll: false },
            )
          }
        >
          {d.availableRoles.map((r) => (
            <option key={r} value={r}>
              {r === "starter" ? "선발" : "불펜"}
            </option>
          ))}
        </select>
      </label>
      <Tabs.Root
        value={window}
        onValueChange={(v) =>
          router.replace(`?role=${role}&window=${v}`, { scroll: false })
        }
      >
        <Tabs.List aria-label="투구 기록 기간" className="ds-tabs">
          {[
            ...(role === "starter" ? ["3", "5", "10"] : ["5", "10", "20"]),
            "season",
          ].map((v) => (
            <Tabs.Trigger key={v} value={v}>
              {v === "season" ? `${label} 시즌` : `최근 ${v}등판`}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <p className="metric-na">
          {role === "starter" ? "최근 20등판" : "최근 3등판"} N/A · 상세 API
          미지원
        </p>
        <Tabs.Content value={window}>
          <p className="ds-notice">
            선택 창 {window === "season" ? "시즌 전체" : `최근 ${window}출전`} ·
            실제 표본 {d.recent.sample.appearances}출전 · 데이터 기준일 {d.asOf}
            . 아래 통계 추이의 이동 창은 최대 5출전으로 고정되며 기세 점수
            추이가 아닙니다.
          </p>
          <section className="panel">
            <h2>선택 {label} 기록</h2>
            <p>{summary(d.recent)}</p>
            {window !== "season" && d.games.length < Number(window) && (
              <p>요청 기간보다 등판 표본이 부족합니다.</p>
            )}
            {d.games.length === 0 && <p>선택 역할의 등판이 없습니다.</p>}
            <p>
              IP의 소수점 뒤는 아웃 수입니다. 5.2 IP = 17아웃 = 5⅔이닝. 합계
              아웃으로 비율을 계산하며 경기별 비율을 평균하지 않습니다.
            </p>
          </section>
          <div className="detail-cards">
            {metrics.map((k) => (
              <article
                className="panel"
                key={k}
                aria-label={`${labels[k]} 요약`}
              >
                <h2>
                  {label} {labels[k]}
                </h2>
                <p className="ds-value">{formatMetric(d.recent.metrics[k])}</p>
                <p>
                  역할 시즌 {formatMetric(d.roleSeason.metrics[k])} · 시즌 전체{" "}
                  {formatMetric(d.season.metrics[k])}
                </p>
                {d.recent.metrics[k].reason && (
                  <p>N/A: 필수 기록 결측 또는 분모 0</p>
                )}
              </article>
            ))}
          </div>
          {d.recent.totals.pitches != null && (
            <section className="panel">
              <h2>투구수</h2>
              <p>{d.recent.totals.pitches}구</p>
            </section>
          )}
          {role === "reliever" && (
            <section className="panel">
              <h2>HLD / SV</h2>
              <p>
                {d.recent.totals.hld ?? "N/A"} / {d.recent.totals.sv ?? "N/A"}
              </p>
              <p>
                홀드·세이브는 상황과 기회에 의존하는 기록이며 승리 기여의 크기나
                기세 점수가 아닙니다.
              </p>
            </section>
          )}
          <section className="panel">
            <h2>시즌 전체와 역할 시즌</h2>
            <p>시즌 전체 (모든 투구 역할): {summary(d.season)}</p>
            <p>
              {label} 시즌만: {summary(d.roleSeason)}
            </p>
          </section>
          <section className="panel">
            <h2>{label} 기세와 신뢰도</h2>
            <p className="ds-value">
              {d.momentum?.rawScore == null
                ? "산출 불가"
                : d.momentum.rawScore.toFixed(1)}
            </p>
            <p>
              범위 0–100 · modelVersion: {d.modelVersion} · 표본 신뢰도:{" "}
              {d.momentum?.confidence ?? "산정 불가"}
            </p>
            <p>
              {window === "season"
                ? "시즌 전체는 기세 모델 기간이 아닙니다."
                : `모델 상태: ${d.momentum?.status}`}
            </p>
            <p>{summary(d.recent)}</p>
            <p>
              {role === "starter"
                ? "선발: K-BB% 45%, WHIP 35%, 등판당 아웃 20%."
                : "불펜: K-BB% 50%, WHIP 30%, HR/BF 20%."}{" "}
              ERA는 작은 표본 변동이 커 점수에 직접 사용하지 않습니다.
            </p>
            <p>
              동일 시즌·대회·역할에서 선택 기간 시작 이전 타 선수 기준 중앙값과
              비교하고 표본 수축을 적용합니다. 조건 미달 시 점수를 보류합니다.
            </p>
            <details>
              <summary>점수의 자세한 근거와 역할별 baseline 비교</summary>
              <p>
                상태: {d.momentum?.status ?? "기간 외"} · 표본 수축 계수:{" "}
                {d.scoreEvidence.reliability ?? "산정 불가"}
              </p>
              <p>
                선발은 선발 기록만, 불펜은 불펜 기록만 기준집단에 포함합니다.
                본인과 선택 기간 이후 기록은 제외합니다.
              </p>
              <DataTable
                caption="역할별 baseline 비교"
                rows={d.scoreEvidence.baseline}
                columns={[
                  { key: "id", label: "지표", render: (b) => b.id },
                  {
                    key: "median",
                    label: "기준 중앙값",
                    render: (b) =>
                      b.median == null ? "N/A" : b.median.toFixed(4),
                  },
                  {
                    key: "count",
                    label: "기준 선수 수",
                    render: (b) => b.count,
                  },
                  {
                    key: "available",
                    label: "사용 가능",
                    render: (b) => (b.available ? "충족" : "표본 부족"),
                  },
                ]}
              />
              {d.scoreEvidence.reasons.map((r, i) => (
                <p key={i}>{r}</p>
              ))}
              {d.scoreEvidence.terms.map((t) => (
                <p key={t.id}>
                  {t.id}: 최근 {t.current.toFixed(4)} · 기준{" "}
                  {t.median?.toFixed(4) ?? "N/A"} · 가중치 {t.weight.toFixed(2)}{" "}
                  · 점수 기여 {t.contribution.toFixed(4)}
                </p>
              ))}
            </details>
          </section>
          <GameAnalysis
            games={d.games}
            kind="pitching"
            asOf={d.asOf}
            season={d.seasonYear}
            competition={d.competition}
            exportPolicy={d.exportPolicy}
          />
        </Tabs.Content>
      </Tabs.Root>
      <DetailFooter d={d} />
    </>
  );
}
