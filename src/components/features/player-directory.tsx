"use client";
import { Skeleton } from "@/components/skeleton";
import { formatKst } from "@/ui/format";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  directoryQuery,
  directoryResponse,
  type DirectoryResult,
} from "@/contracts/player-directory";
const roles: Record<string, string> = {
  hitter: "타자",
  starter: "선발",
  reliever: "불펜",
};
const teamName = (id: string) =>
  `샘플 ${String.fromCharCode(65 + Number(id.split("_")[1]))}팀`;
export function PlayerDirectory() {
  const params = useSearchParams();
  return <Directory key={params.toString()} />;
}
function Directory() {
  const params = useSearchParams();
  const router = useRouter();
  const queryString = params.toString();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [error, setError] = useState(() =>
    directoryQuery.safeParse(Object.fromEntries(params)).success
      ? ""
      : "유효하지 않은 검색 조건입니다. 조건을 초기화해 주세요.",
  );
  const [retry, setRetry] = useState(0);
  const [composing, setComposing] = useState(false);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const parsed = directoryQuery.safeParse(Object.fromEntries(params));
  const valid = parsed.success;
  function change(key: string, value: string) {
    const next = new URLSearchParams(queryString);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`/players?${next}`, { scroll: false });
  }
  useEffect(() => {
    if (search === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => {
      if (!composing) change("q", search.trim());
    }, 350);
    return () => clearTimeout(timer);
    // URL changes also cancel pending searches (including browser Back).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, queryString, composing]);
  useEffect(() => {
    const controller = new AbortController();
    if (!valid) {
      return;
    }
    fetch(`/api/v1/player-directory?${queryString}`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error);
        }
        const parsed = directoryResponse.safeParse(await response.json());
        if (!parsed.success)
          throw new Error("서버 응답 형식이 유효하지 않습니다.");
        return parsed.data;
      })
      .then((body) => {
        if (!controller.signal.aborted) setResult(body);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            navigator.onLine
              ? e instanceof Error
                ? e.message
                : "서버 오류"
              : "오프라인입니다. 연결 후 다시 시도해 주세요.",
          );
      });
    return () => controller.abort();
  }, [queryString, retry, valid]);
  const value = (key: string, fallback = "") => params.get(key) ?? fallback;
  return (
    <>
      <div className="page-heading">
        <span className="badge">DEMO</span>
        <h1>선수 탐색</h1>
        <p>가상 선수 150명 · 정규시즌 · 실제 공식 기록이 아닙니다.</p>
      </div>
      <section
        className="panel directory-filters"
        aria-label="선수 검색 및 필터"
      >
        <label>
          선수명 검색
          <input
            type="search"
            maxLength={100}
            value={search}
            placeholder="한국어 선수명 또는 가상 A-01"
            onChange={(e) => setSearch(e.target.value)}
            onCompositionStart={() => {
              setComposing(true);
            }}
            onCompositionEnd={(e) => {
              setComposing(false);
              setSearch(e.currentTarget.value);
            }}
          />
        </label>
        <label>
          시즌
          <select
            value={value("season", "2026")}
            onChange={(e) => change("season", e.target.value)}
          >
            <option value="2026">2026 DEMO</option>
          </select>
        </label>
        <label>
          출전 소속팀
          <select
            value={value("team")}
            onChange={(e) => change("team", e.target.value)}
          >
            <option value="">전체 팀</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={`sample_${i}`}>
                {teamName(`sample_${i}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          선수 범위
          <select
            value="appeared"
            onChange={(e) => change("membership", e.target.value)}
            aria-describedby="roster-reason"
          >
            <option value="appeared">시즌 출전 선수</option>
            <option value="current" disabled>
              현재 1군 등록
            </option>
          </select>
        </label>
        <label>
          역할
          <select
            aria-label="역할"
            value={value("role")}
            onChange={(e) => change("role", e.target.value)}
          >
            <option value="">전체 역할</option>
            {Object.entries(roles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          주 포지션
          <select disabled aria-describedby="roster-reason">
            <option>데이터 없음</option>
          </select>
        </label>
        <label>
          선택 기간
          <select
            value={value("window", "10")}
            onChange={(e) => change("window", e.target.value)}
          >
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                최근 {n}경기 (선수 출전 기준)
              </option>
            ))}
          </select>
        </label>
        <label>
          정렬
          <select
            value={value("sort", "name")}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="name">이름 가나다순</option>
            <option value="games">최근 경기 수 많은 순</option>
            <option value="ops">OPS 높은 순</option>
            <option value="era">ERA 낮은 순</option>
            <option value="score">기세 점수 높은 순</option>
            <option disabled>기세 변화량 — 이전 스냅샷 없음</option>
          </select>
        </label>
        <p id="roster-reason">
          1군 등록·주 포지션·등번호 이력은 제공되지 않습니다. 팀 필터는 시즌
          출전 당시 소속팀 기준입니다.
        </p>
        <button
          className="button"
          onClick={() => router.push("/players", { scroll: false })}
        >
          조건 초기화
        </button>
      </section>
      <p className="directory-note">
        부분 데이터: OPS 필수 항목(HBP·SF)이 없어 OPS는 미제공입니다. 결측
        기록은 0으로 대체하지 않습니다. 점수는 역할별 모델이며 역할을 선택해
        비교하세요.
      </p>
      <div role="status" aria-live="polite">
        {!error && !result
          ? "선수 목록을 불러오는 중…"
          : result
            ? `검색 결과 ${result.total}명 · ${result.page}/${result.pages}페이지`
            : ""}
      </div>
      {!error && !result && <Skeleton />}
      {error && (
        <section className="panel" role="alert">
          <p>{error}</p>
          <button
            className="button"
            onClick={() => {
              setResult(null);
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </section>
      )}
      {result && (
        <>
          <p>
            출처 {result.source} · {result.season} 정규시즌 · 기준일{" "}
            {formatKst(result.asOf)} · 업데이트 {formatKst(result.updatedAt)}
          </p>
          {!result.total ? (
            <section className="panel">
              <h2>
                {search || value("team") || value("role")
                  ? "조건에 맞는 선수가 없습니다"
                  : "출전 기록이 없습니다"}
              </h2>
              <p>검색어나 필터를 변경해 주세요.</p>
            </section>
          ) : (
            <ul className="directory-grid" aria-label="선수 검색 결과">
              {result.players.map((p, i) => (
                <li className="panel" key={p.id}>
                  <div className="directory-identity">
                    <span className="directory-avatar" aria-hidden="true">
                      {p.name.slice(0, 1)}
                    </span>
                    <div>
                      <Link
                        ref={(el) => {
                          links.current[i] = el;
                        }}
                        href={`/players/${p.id}`}
                        onKeyDown={(e) => {
                          const target =
                            e.key === "ArrowDown"
                              ? i + 1
                              : e.key === "ArrowUp"
                                ? i - 1
                                : e.key === "Home"
                                  ? 0
                                  : e.key === "End"
                                    ? result.players.length - 1
                                    : null;
                          if (target !== null) {
                            e.preventDefault();
                            links.current[target]?.focus();
                          }
                        }}
                      >
                        {p.name}
                      </Link>
                      <p>
                        {roles[p.role]} · {p.id}
                      </p>
                    </div>
                  </div>
                  <p>
                    출전 소속 이력(최근순):{" "}
                    {p.teams.map(teamName).join(", ") || "미상"}
                  </p>
                  <p>주 포지션·등번호: 미제공</p>
                  <dl className="directory-metrics">
                    <div>
                      <dt>선택 기간 표본</dt>
                      <dd>{p.games}경기</dd>
                    </div>
                    <div>
                      <dt>{p.role === "hitter" ? "OPS" : "ERA"}</dt>
                      <dd>
                        {(p.role === "hitter" ? p.ops : p.era)?.toFixed(3) ??
                          "기록 없음"}
                      </dd>
                    </div>
                    <div>
                      <dt>기세</dt>
                      <dd>{p.score?.toFixed(1) ?? "산출 불가"}</dd>
                    </div>
                    <div>
                      <dt>기세 변화량</dt>
                      <dd>미제공</dd>
                    </div>
                  </dl>
                  <span className="badge">
                    신뢰도{" "}
                    {p.confidence === "high"
                      ? "높음"
                      : p.confidence === "medium"
                        ? "보통"
                        : p.confidence === "low"
                          ? "낮음"
                          : "미확인"}
                  </span>
                  <p>
                    최근 {p.role === "hitter" ? "출전" : "등판"}{" "}
                    {p.lastAppearance ?? "없음"} · 휴식·결장 여부 미확인
                  </p>
                  <small>원천 {p.source} · DEMO</small>
                </li>
              ))}
            </ul>
          )}
          <nav className="directory-pagination" aria-label="검색 결과 페이지">
            <button
              className="button"
              disabled={result.page <= 1}
              onClick={() => change("page", String(result.page - 1))}
            >
              이전 페이지
            </button>
            <span aria-current="page">
              {result.page} / {result.pages}
            </span>
            <button
              className="button"
              disabled={result.page >= result.pages}
              onClick={() => change("page", String(result.page + 1))}
            >
              다음 페이지
            </button>
          </nav>
          <p>
            Tab으로 선수와 버튼 이동 · 선수 링크에서 ↑↓, Home, End로 이동 ·
            Enter로 상세 보기
          </p>
        </>
      )}
    </>
  );
}
