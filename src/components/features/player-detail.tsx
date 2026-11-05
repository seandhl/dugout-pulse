"use client";
import { DetailSections, useDetailQuery } from "./detail-sections";
import { SeasonRecords } from "./season-records";
import { releaseFetch } from "@/components/release-provider";
import { useEffect, useState } from "react";
import Link from "@/components/release-provider";
import { DetailHeader, DetailFooter } from "./detail-shared";
import { useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import type { PlayerDetail } from "@/server/reads/player-detail";
import { formatMetric } from "@/stats/batting";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/skeleton";
const GameAnalysis = dynamic(
  () => import("./game-analysis").then((m) => m.GameAnalysis),
  {
    loading: () => <Skeleton />,
  },
);
const metrics = ["ops", "avg", "obp", "slg"] as const;
const reasons = {
  missing_fields: "필수 원시 기록 결측",
  zero_denominator: "분모가 0",
  small_sample: "표본 부족",
};
export function PlayerDetailView({ id }: { id: string }) {
  const window = useSearchParams().get("window") ?? "10";
  return <DetailContent key={`${id}/${window}`} id={id} window={window} />;
}
function DetailContent({ id, window }: { id: string; window: string }) {
  const changeQuery = useDetailQuery();
  const [data, setData] = useState<PlayerDetail | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    releaseFetch(
      `/api/v1/players/${encodeURIComponent(id)}/batting?window=${encodeURIComponent(window)}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
        cache: "no-store",
      },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "연결 오류");
      });
    return () => controller.abort();
  }, [id, window, retry]);
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
  if (!data) return <p role="status">타자 상세를 불러오는 중…</p>;
  const d = data,
    score = d.momentum?.rawScore ?? null;
  return (
    <>
      <DetailHeader d={d} id={id} roleLabel="타자" />
      <DetailSections season={<SeasonRecords d={d} />}>
        <aside className="ds-notice" aria-label="기록 해석 안내">
          최근 출전 데이터에 대한 설명입니다. 기준일 이후 변화·휴식·결장 여부는
          미확인이며 현재 컨디션을 뜻하지 않습니다.
        </aside>
        <Tabs.Root
          value={window}
          onValueChange={(v) => changeQuery({ window: v })}
        >
          <Tabs.List aria-label="타격 기록 기간" className="ds-tabs">
            {["3", "5", "10", "20", "season"].map((v) => (
              <Tabs.Trigger key={v} value={v}>
                {v === "season" ? "시즌 전체" : `최근 ${v}출전`}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value={window}>
            <p className="ds-notice">
              선택 창 {window === "season" ? "시즌 전체" : `최근 ${window}출전`}{" "}
              · 실제 표본 {d.recent.sample.appearances}출전 · 데이터 기준일{" "}
              {d.asOf}. 아래 통계 추이의 이동 창은 최대 5출전으로 고정되며 기세
              점수 추이가 아닙니다.
            </p>
            <div className="detail-cards">
              {metrics.map((k) => {
                const m = d.recent.metrics[k],
                  s = d.season.metrics[k];
                return (
                  <article
                    className="panel"
                    key={k}
                    aria-label={`${k.toUpperCase()} 요약`}
                  >
                    <h2>
                      {window === "season" ? "시즌" : "최근"} {k.toUpperCase()}
                    </h2>
                    <p className="ds-value">{formatMetric(m)}</p>
                    <p>
                      시즌 {formatMetric(s)} · 차이{" "}
                      {m.value === null || s.value === null
                        ? "N/A"
                        : (m.value - s.value >= 0 ? "+" : "") +
                          (m.value - s.value).toFixed(3)}
                    </p>
                    <p>
                      {d.recent.sample.appearances}출전 ·{" "}
                      {d.recent.sample.pa ?? "N/A"} PA ·{" "}
                      {d.recent.totals.ab ?? "N/A"} AB
                    </p>
                    {m.reason && <p>N/A: {reasons[m.reason]}</p>}
                  </article>
                );
              })}
            </div>
            <section className="panel">
              <h2>최근 출전 기세</h2>
              <p className="ds-value">
                {score === null ? "산출 불가" : score.toFixed(1)}
              </p>
              {score !== null && (
                <meter min={0} max={100} value={score} aria-label="기세 점수">
                  {score}/100
                </meter>
              )}
              <p>범위 0–100 · modelVersion: {d.modelVersion}</p>
              <p>
                sample reliability: {d.momentum?.confidence ?? "산정 불가"} ·{" "}
                {d.recent.sample.appearances}출전 /{" "}
                {d.recent.sample.pa ?? "N/A"} PA
              </p>
              <ul>
                <li>
                  {window === "season"
                    ? "시즌 전체는 기세 모델 기간이 아닙니다."
                    : d.momentum?.status === "ready"
                      ? d.momentum.explanation.reasons
                          .slice(0, 2)
                          .map(
                            (r) =>
                              `${r.direction}: ${r.text.replace(/\d+\.\d{4,}/g, (v) => Number(v).toFixed(3))}`,
                          )
                          .join(" / ")
                      : `모델 상태: ${d.momentum?.status} · 결측·표본·기준집단 조건을 충족할 때만 산출합니다.`}
                </li>
                <li>
                  최근 안타 {d.recent.totals.h ?? "N/A"} / 타수{" "}
                  {d.recent.totals.ab ?? "N/A"}로 AVG{" "}
                  {formatMetric(d.recent.metrics.avg)}입니다.
                </li>
                <li>
                  ISO {formatMetric(d.recent.metrics.iso)}는 SLG − AVG로 장타
                  기여를 설명합니다.
                </li>
                <li>
                  HBP·SF가 미제공되어 OBP·OPS는 N/A입니다. 결측을 0으로 대체하지
                  않습니다.
                </li>
              </ul>
            </section>
            <section className="panel">
              <h2>시즌 vs 최근 요약</h2>
              <p>
                시즌 {d.season.sample.appearances}출전 /{" "}
                {d.season.sample.pa ?? "N/A"} PA 대비 선택 기간{" "}
                {d.recent.sample.appearances}출전 /{" "}
                {d.recent.sample.pa ?? "N/A"} PA. 비율은 원시 기록 합산 후
                계산하며 경기별 비율을 평균하지 않습니다.
              </p>
              {window !== "season" && d.games.length < Number(window) && (
                <p>요청 기간보다 출전 표본이 부족합니다.</p>
              )}
            </section>
            <GameAnalysis
              games={d.games}
              kind="batting"
              asOf={d.asOf}
              season={d.seasonYear}
              competition={d.competition}
              exportPolicy={d.exportPolicy}
            />
          </Tabs.Content>
        </Tabs.Root>
      </DetailSections>
      <DetailFooter d={d} />
    </>
  );
}
