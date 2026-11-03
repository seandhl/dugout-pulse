import { formatKst } from "@/ui/format";
import { pipeline } from "@/server/ingest/pipeline";
import { PitcherDetailView } from "@/components/features/pitcher-detail";
import { PlayerDetailView } from "@/components/features/player-detail";
import { notFound } from "next/navigation";
import { playersService } from "@/server/composition";
import { readDemo } from "@/server/db/demo";
import { ApiError } from "@/server/http/errors";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: "선수 기록 상세",
    alternates: { canonical: `/players/${encodeURIComponent(id)}` },
  };
}
export const dynamic = "force-dynamic";
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (typeof query.snapshot === "string") {
    const state = await pipeline.readPublicState();
    const snapshot = state.momentumSnapshots?.[query.snapshot];
    if (!snapshot || snapshot.playerId !== id) notFound();
    return (
      <article className="panel">
        <span className="badge">DEMO</span>
        <h1>{id} 게시 기록 상세</h1>
        <p>
          {snapshot.season}{" "}
          {snapshot.competition === "regular" ? "정규시즌" : "포스트시즌"} ·{" "}
          {snapshot.role} · 최근 {snapshot.window}출전/등판
        </p>
        <p>
          점수 {snapshot.score?.toFixed(1) ?? "산출 보류"} · 신뢰도{" "}
          {snapshot.confidence ?? "미확인"} · 표본 {snapshot.sampleSize}
        </p>
        <p>
          기준일 {formatKst(snapshot.asOf)} · 계산{" "}
          {formatKst(snapshot.computedAt)} · {snapshot.algorithmVersion}
        </p>
        <p>
          출처 {snapshot.sourceIds.join(", ")} · 마지막 경기{" "}
          {snapshot.dataAsOfGameId ?? "없음"}
        </p>
        <details>
          <summary>원천 참조와 계산 근거</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(
              {
                inputRefs: snapshot.inputRefs,
                explanation: snapshot.explanation,
              },
              null,
              2,
            )}
          </pre>
        </details>
        <a href="/rankings">랭킹으로 이동</a>
      </article>
    );
  }

  if (
    readDemo().players.some(
      (p) => p.playerId === id && p.listedRoles.includes("batter"),
    )
  )
    return <PlayerDetailView id={id} />;
  if (
    readDemo().players.some(
      (p) =>
        p.playerId === id &&
        p.listedRoles.some((r) => r === "starter" || r === "reliever"),
    )
  )
    return (
      <PitcherDetailView
        id={id}
        defaultRole={
          readDemo()
            .players.find((p) => p.playerId === id)!
            .listedRoles.includes("starter")
            ? "starter"
            : "reliever"
        }
      />
    );
  const result = await playersService
    .find(id, { season: 2026, competition: "regular" })
    .catch((error) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  const p = result.data;
  const teamName =
    readDemo().teams.find((t) => t.teamId === p.teamId)?.name ?? "소속 미상";
  const roles: Record<string, string> = {
    batter: "타자",
    starter: "선발",
    reliever: "불펜",
  };
  const labels: Record<string, string> = {
    ab: "타수",
    h: "안타",
    hr: "홈런",
    r: p.listedRoles.includes("batter") ? "득점" : "실점",
    rbi: "타점",
    so: "삼진",
    pa: "타석",
    bb: "볼넷",
    outsRecorded: "투구 아웃 수",
    er: "자책점",
    bf: "상대 타자 수",
  };
  return (
    <>
      <div className="page-heading">
        <h1>{p.displayName}</h1>
        <p>DEMO — 가상의 선수와 경기 기록</p>
      </div>
      <p>
        역할: {p.listedRoles.map((r) => roles[r]).join(", ")} · 소속: {teamName}{" "}
        · 표본: {p.sampleSize}경기
      </p>
      <p>
        출처: {p.sourceId} · {result.meta.season} 정규시즌 · 기준 시각:{" "}
        {result.meta.asOf}
      </p>
      <dl>
        {Object.entries(p.stats ?? {}).map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key] ?? key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        가상 전시 경기 규칙: 양 팀 27아웃, 동점 허용. 휴식·미출장·부상·이적
        이력은 fixture에 기록합니다. 홈에서는 실험용 DEMO 기세 모델을 확인할 수
        있습니다.
      </p>
    </>
  );
}
