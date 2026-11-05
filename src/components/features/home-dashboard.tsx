"use client";
import { PlayerAvatarFallback } from "@/components/ui";
import { releaseFetch } from "@/components/release-provider";
import Link from "@/components/release-provider";
import { useEffect, useState } from "react";
import { Tabs } from "radix-ui";
import { homeResponse, type HomeData } from "@/contracts/home";
const roles = { batter: "타자", starter: "선발", reliever: "불펜" } as const;
const date = (value: string) =>
  new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export function HomeDashboard() {
  const [role, setRole] = useState("batter");
  const [windowSize, setWindowSize] = useState("10");
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    releaseFetch(`/api/v1/home?role=${role}&window=${windowSize}`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return homeResponse.parse(await r.json());
      })
      .then((body) => {
        if (!controller.signal.aborted) setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [role, windowSize, retry]);
  function change(value: string, kind: "role" | "window") {
    setData(null);
    setError(false);
    if (kind === "role") setRole(value);
    else setWindowSize(value);
  }
  const ranked = (data?.players ?? [])
    .filter((p) => p.score !== null && p.confidence !== "low")
    .sort((a, b) => b.score! - a.score! || a.playerId.localeCompare(b.playerId))
    .slice(0, 5);
  const analyzable = (data?.players ?? [])
    .filter((p) => p.score !== null)
    .sort(
      (a, b) =>
        b.sampleSize - a.sampleSize || a.playerId.localeCompare(b.playerId),
    )
    .slice(0, 3);
  const results = search.trim()
    ? data?.players.filter((p) => `${p.name} ${p.team}`.includes(search.trim()))
    : [];
  const card = (p: HomeData["players"][number], rank?: number) => (
    <Link
      className="panel home-player"
      href={`/players/${p.playerId}`}
      key={p.playerId}
    >
      <div className="home-card-top">
        <span className="eyebrow">{rank ? `${rank}위` : p.team}</span>
        <span className="badge">DEMO</span>
      </div>
      <div className="player-summary">
        <PlayerAvatarFallback label={p.name} />
        <h3>
          {p.name} <span aria-hidden="true">↗</span>
        </h3>
      </div>
      <p>
        {p.team} · {roles[role as keyof typeof roles]} · 포지션 미제공
      </p>
      <strong className="home-score">
        {p.score?.toFixed(1) ?? "산출 불가"}
        <small> 기세 점수</small>
      </strong>
      <p>
        {p.confidence === "low"
          ? "⚠ 낮은 신뢰도"
          : p.confidence === "high"
            ? "신뢰도 높음"
            : "신뢰도 보통"}{" "}
        · 표본 {p.sampleSize}/{windowSize}출전
      </p>
      <p className="metric-na">이전 기록 대비 변화: 미제공</p>
      <p className="ds-meta">
        최근 출전 {p.lastAppearance ?? "없음"}
        <br />
        출처 {p.sourceId} · 등록 상태 미확인
      </p>
    </Link>
  );
  return (
    <div className="home-dashboard">
      <section className="home-hero">
        <span className="eyebrow">최근 기록 분석</span>
        <h1>
          지금, 누가
          <br />
          <span>좋은 흐름일까?</span>
        </h1>
        <p>
          최근 출전 기록으로 읽는 선수의 기세.
          <br />
          타자·선발·불펜의 최근 기록을 한눈에 비교하세요.
        </p>
        <a href="#momentum" className="button">
          최근 기세 살펴보기 ↓
        </a>
        <div className="home-search">
          <label htmlFor="home-search">팀·선수 검색</label>
          <input
            id="home-search"
            type="search"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="가상 선수명 또는 샘플 팀명"
          />
          <p className="ds-meta">선택한 역할의 선수만 검색합니다.</p>
          {search.trim() && (
            <div aria-live="polite">
              {!data
                ? "데이터를 불러오는 중입니다."
                : results?.length
                  ? results.map((p) => (
                      <Link
                        className="player-summary home-player-result"
                        key={p.playerId}
                        href={`/players/${p.playerId}`}
                      >
                        <PlayerAvatarFallback label={p.name} />
                        <span>
                          <strong>{p.name}</strong> · {p.team} ·{" "}
                          {roles[role as keyof typeof roles]}
                          <br />
                          포지션 미제공 · 기세{" "}
                          {p.score?.toFixed(1) ?? "산출 불가"} · DEMO
                        </span>
                      </Link>
                    ))
                  : "조건에 맞는 선수가 없습니다."}
            </div>
          )}
        </div>
      </section>
      <section className="panel home-status" aria-label="데이터 상태">
        <span className="badge">DEMO</span>
        {data ? (
          <>
            <span>
              시즌{" "}
              <b>
                {data.season} ·{" "}
                {data.competition === "regular"
                  ? "정규시즌"
                  : data.competition === "postseason"
                    ? "포스트시즌"
                    : data.competition}
              </b>
            </span>
            <span>
              마지막 경기 <b>{data.lastGame ?? "없음"}</b>
            </span>
            <span>
              마지막 업데이트 <b>{date(data.lastUpdatedAt)} KST</b>
            </span>
            <span>
              출처 <b>{data.source} · 자체 제작 가상 기록</b>
            </span>
            <span>
              데이터 기준 <b>{date(data.asOf)} KST</b>
            </span>
          </>
        ) : (
          <p>데이터 상태 {error ? "확인 불가" : "불러오는 중…"}</p>
        )}
      </section>
      <p className="home-notice">
        실시간 기록이 아닙니다. 오프시즌·휴식·결장에도 달력상 최근 일수가 아닌{" "}
        <b>최근 출전 기준</b>입니다. 업데이트 시각은 fixture 제작 시각이며, 현재
        1군 등록 상태는 확인되지 않았습니다.
      </p>
      <section id="momentum">
        <div className="section-heading">
          <div>
            <span className="eyebrow">선수 기세</span>
            <h2>최근 기세 상위 5명</h2>
          </div>
          <span className="badge">DEMO</span>
        </div>
        <Tabs.Root value={role} onValueChange={(v) => change(v, "role")}>
          <Tabs.List className="ds-tabs" aria-label="선수 역할">
            {Object.entries(roles).map(([value, label]) => (
              <Tabs.Trigger key={value} value={value}>
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <fieldset className="ds-segment">
            <legend>분석 기간 · 최근 출전 경기 수</legend>
            <div>
              {["3", "5", "10", "20"].map((n) => (
                <button
                  key={n}
                  aria-pressed={windowSize === n}
                  onClick={() => change(n, "window")}
                >
                  {n}경기
                </button>
              ))}
            </div>
          </fieldset>
          <details className="home-excluded">
            <summary>분석 기간 안내</summary>
            <p className="ds-meta">
              짧은 기간은 변화에 민감하고 긴 기간은 흐름을 안정적으로 보여
              줍니다. 선발은 선발 등판, 불펜은 구원 등판만 셉니다.
            </p>
          </details>
          <Tabs.Content value={role}>
            <details className="home-excluded">
              <summary>랭킹 선정 기준과 점수 해석</summary>
              <p>
                점수를 계산할 수 있고 신뢰도 보통 이상인 선수만 포함합니다.
                점수가 높을수록 위에 표시하며, 동점은 선수 ID순입니다. 역할별
                점수는 직접 비교할 수 없고, 승리 확률이나 절대 실력을 의미하지
                않습니다.
              </p>
            </details>
            {error ? (
              <div role="alert" className="panel empty">
                <p>데이터를 불러오지 못했습니다. 연결을 확인해 주세요.</p>
                <button
                  className="button"
                  onClick={() => {
                    setError(false);
                    setRetry((n) => n + 1);
                  }}
                >
                  다시 시도
                </button>
              </div>
            ) : !data ? (
              <p role="status" className="panel empty">
                가상 기록을 분석하는 중…
              </p>
            ) : (
              <>
                <div className="home-grid" data-testid="home-rankings">
                  {ranked.map((p, i) => card(p, i + 1))}
                </div>
                {!ranked.length && (
                  <p className="panel empty">
                    이 기간에 순위 조건을 충족하는 선수가 없습니다. 기간을 늘려
                    보세요.
                  </p>
                )}
                <details className="home-excluded">
                  <summary>낮은 신뢰도·산출 불가 선수 확인</summary>
                  {data.players
                    .filter((p) => p.confidence === "low" || p.score === null)
                    .map((p) => (
                      <p key={p.playerId}>
                        <Link
                          className="player-summary home-player-result"
                          href={`/players/${p.playerId}`}
                        >
                          <PlayerAvatarFallback label={p.name} />
                          <span>
                            {p.name} · {p.team} ·{" "}
                            {roles[role as keyof typeof roles]}
                            <br />
                            포지션 미제공 · 기세{" "}
                            {p.score?.toFixed(1) ?? "산출 불가"} · DEMO
                          </span>
                        </Link>{" "}
                        ·{" "}
                        {p.confidence === "low"
                          ? "낮은 신뢰도 — 순위 제외"
                          : `산출 불가 (${p.reason})`}{" "}
                        · 표본 {p.sampleSize}/{windowSize}출전
                      </p>
                    ))}
                </details>
              </>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </section>
      <section className="home-section">
        <span className="eyebrow">기록 살펴보기</span>
        <h2>출전 기록이 충분한 선수</h2>
        <details className="home-excluded">
          <summary>선정 기준</summary>
          <p>
            선택한 역할과 기간에서 기세를 계산할 수 있는 선수 중 출전 경기 수가
            많은 순서입니다. 동점은 선수 ID순이며 실력 추천이 아닙니다.
          </p>
        </details>
        <div className="home-grid">{analyzable.map((p) => card(p))}</div>
        {data && !analyzable.length && (
          <p>분석 가능한 표본이 없습니다. 더 긴 기간을 선택해 주세요.</p>
        )}
      </section>
      <section className="panel home-guide">
        <div>
          <span className="eyebrow">기세 점수 안내</span>
          <h2>기세는 Dugout Pulse 고유의 최근 흐름 점수입니다.</h2>
          <p>
            동일 시즌·대회·역할의 기록을 기준으로 최근 성과를 요약합니다. 높은
            점수가 미래 활약이나 선수의 절대 실력을 보장하지 않습니다. 표본
            부족·휴식·결장에 따라 해석이 달라집니다.
          </p>
          <p className="ds-meta">
            체험용 점수 모형 {data?.model ?? "확인 중"} · 공식 선수 평가가
            아닙니다.
          </p>
        </div>
        <div>
          <Link href="/compare" className="button">
            선수 비교하기
          </Link>

          <Link href="/about" className="text-button">
            산식·출처·한계 알아보기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
