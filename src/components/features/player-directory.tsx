"use client";
import { releaseFetch } from "@/components/release-provider";
import { Skeleton } from "@/components/skeleton";
import { formatKst } from "@/ui/format";
import Link from "@/components/release-provider";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReleaseRouter } from "@/components/release-provider";
import { useSearchParams } from "next/navigation";
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
  /^sample_[0-9]$/.test(id)
    ? `샘플 ${String.fromCharCode(65 + Number(id.split("_")[1]))}팀`
    : `DEMO ${id}`;
export function PlayerDirectory() {
  return <Directory />;
}
function Directory() {
  const rawParams = useSearchParams();
  const params = useMemo(() => {
    const values = new URLSearchParams(rawParams);
    values.delete("releaseId");
    return values;
  }, [rawParams]);
  const router = useReleaseRouter();
  const queryString = params.toString();
  const hasDuplicates =
    new Set(params.keys()).size !== [...params.keys()].length;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [error, setError] = useState(() =>
    !hasDuplicates &&
    directoryQuery.safeParse(Object.fromEntries(params)).success
      ? ""
      : "유효하지 않은 검색 조건입니다. 조건을 초기화해 주세요.",
  );
  const [retry, setRetry] = useState(0);
  const [composing, setComposing] = useState(false);
  const [previousQuery, setPreviousQuery] = useState(queryString);
  const resultHeading = useRef<HTMLDivElement>(null);
  const moveToResults = useRef(false);
  const restoreScroll = useRef<number | null>(null);
  if (previousQuery !== queryString) {
    setPreviousQuery(queryString);
    setSearch(params.get("q") ?? "");
    setResult(null);
    setError(
      !hasDuplicates &&
        directoryQuery.safeParse(Object.fromEntries(params)).success
        ? ""
        : "유효하지 않은 검색 조건입니다. 조건을 초기화해 주세요.",
    );
  }
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const parsed = directoryQuery.safeParse(Object.fromEntries(params));
  const valid = parsed.success && !hasDuplicates;
  function change(key: string, value: string) {
    const next = new URLSearchParams(queryString);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    moveToResults.current = key === "page";
    restoreScroll.current = key === "page" ? null : window.scrollY;
    // Commit the pending name together with a filter change, including fast taps.
    if (
      key !== "q" &&
      !composing &&
      search.trim() !== (params.get("q") ?? "")
    ) {
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
    }
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
    releaseFetch(`/api/v1/player-directory?${queryString}`, {
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
        if (!controller.signal.aborted) {
          if (Number(params.get("page") ?? "1") !== body.page) {
            const canonical = new URLSearchParams(queryString);
            if (body.page === 1) canonical.delete("page");
            else canonical.set("page", String(body.page));
            router.replace(`/players?${canonical}`, { scroll: false });
          }
          setResult(body);
          if (moveToResults.current) {
            requestAnimationFrame(() => resultHeading.current?.focus());
            moveToResults.current = false;
          }
        }
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
  }, [queryString, retry, valid, params, router]);
  useEffect(() => {
    if (!result) return;
    try {
      const saved = sessionStorage.getItem(`directory-return:${queryString}`);
      if (!saved) return;
      sessionStorage.removeItem(`directory-return:${queryString}`);
      const position: unknown = JSON.parse(saved);
      if (typeof position !== "object" || position === null) return;
      const { id, y } = position as { id?: unknown; y?: unknown };
      if (
        typeof id !== "string" ||
        typeof y !== "number" ||
        !Number.isFinite(y)
      )
        return;
      const index = result.players.findIndex((p) => p.id === id);
      requestAnimationFrame(() => {
        links.current[index]?.focus({ preventScroll: true });
        window.scrollTo(0, y);
      });
    } catch {
      /* Storage may be unavailable; browser history still works. */
    }
  }, [result, queryString]);
  useLayoutEffect(() => {
    if (result && restoreScroll.current !== null) {
      window.scrollTo(0, restoreScroll.current);
      restoreScroll.current = null;
    }
  }, [result]);
  const value = (key: string, fallback = "") => params.get(key) ?? fallback;
  return (
    <>
      <div className="page-heading">
        <span className="badge">DEMO</span>
        <h1>선수 탐색</h1>
        <p>
          가상 선수 {result?.playerCount ?? "…"}명 · 정규시즌 · 실제 공식 기록이
          아닙니다.
        </p>
      </div>
      <section
        className="panel directory-filters"
        aria-label="선수 검색 및 필터"
      >
        <fieldset>
          <legend>이름·소속·역할</legend>
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
            기록 집계 팀
            <select
              value={value("team")}
              onChange={(e) => change("team", e.target.value)}
            >
              <option value="">전체 팀</option>
              {(
                result?.teams ??
                Array.from({ length: 10 }, (_, i) => ({
                  teamId: `sample_${i}`,
                  name: teamName(`sample_${i}`),
                }))
              ).map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.name}
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
                현재 1군 등록 (등록 스냅샷 없음)
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
        </fieldset>
        <fieldset>
          <legend>최근 경기·표본·정렬</legend>
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
            표본 상태
            <select
              value={value("sample")}
              onChange={(e) => change("sample", e.target.value)}
            >
              <option value="">전체 표본</option>
              <option value="complete">선택 경기 수 충족</option>
              <option value="short">선택 경기 수 미달</option>
              <option value="unscored">기세 산출 불가</option>
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
          <p>
            동점은 이름 가나다순·선수 ID순으로 고정합니다. 표본 충족은 기세
            신뢰도와 다릅니다.
          </p>
        </fieldset>
        <p id="roster-reason">
          시즌 출전은 선택 시즌·대회에서 1경기 이상 출전한 선수입니다. 현재 1군
          등록과는 다릅니다. 등록 스냅샷이 없어 등록 여부 미확인입니다. 출전
          기록으로 등록을 추정하지 않습니다. 주 포지션·등번호 이력은 제공되지
          않습니다. 팀 필터는 시즌 출전 당시 소속팀 기준입니다. 팀 선택 시 해당
          팀 소속 출전만 먼저 추린 뒤 최근 N경기와 OPS·ERA·최근 출전일을 다시
          집계합니다.
        </p>
        <button
          className="button"
          onClick={() => {
            setSearch("");
            setComposing(false);
            router.push("/players", { scroll: false });
          }}
        >
          조건 초기화
        </button>
      </section>
      <div aria-label="활성 필터" className="directory-pagination">
        {["q", "team", "role", "window", "sample", "sort"]
          .filter((key) => params.has(key))
          .map((key) => {
            const labels: Record<string, string> = {
              q: "이름",
              team: "팀",
              role: "역할",
              window: "최근 경기",
              sample: "표본",
              sort: "정렬",
            };
            const choices: Record<string, string> = {
              ...roles,
              complete: "선택 경기 수 충족",
              short: "선택 경기 수 미달",
              unscored: "기세 산출 불가",
              name: "이름 가나다순",
              games: "최근 경기 수 많은 순",
              ops: "OPS 높은 순",
              era: "ERA 낮은 순",
              score: "기세 점수 높은 순",
            };
            return (
              <button
                className="button"
                key={key}
                onClick={() => change(key, "")}
              >
                {labels[key]}:{" "}
                {key === "team"
                  ? teamName(value(key))
                  : (choices[value(key)] ?? value(key))}{" "}
                ×
              </button>
            );
          })}
        <button
          className="button"
          onClick={() => {
            window.prompt("필터 공유 URL을 복사하세요", window.location.href);
          }}
        >
          필터 URL 공유
        </button>
      </div>
      <p>
        DEMO는 2026 정규시즌만 지원합니다. 시즌 출전 선수만 탐색할 수 있습니다.
      </p>
      <p className="directory-note">
        {result?.source === "demo-file-source"
          ? "파일 게시 DEMO: 제공된 항목으로 통계를 계산합니다. 누락 항목은 N/A입니다."
          : "부분 데이터: OPS 필수 항목(HBP·SF)이 없어 OPS는 미제공입니다."}{" "}
        결측 기록은 0으로 대체하지 않습니다. 점수는 역할별 모델이며 역할을
        선택해 비교하세요. 팀 필터 후에도 전체 기세 점수입니다. 기세 표본은 전체
        팀 최근 N출전/역할 등판이므로 위 기록 표본과 다를 수 있습니다.
      </p>
      <div ref={resultHeading} tabIndex={-1} role="status" aria-live="polite">
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
                {search || value("team") || value("role") || value("sample")
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
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              `directory-return:${queryString}`,
                              JSON.stringify({ id: p.id, y: window.scrollY }),
                            );
                          } catch {
                            /* Optional restoration must not block navigation. */
                          }
                        }}
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
                  <p>등록 여부 미확인 · 등록 스냅샷 없음</p>
                  <dl className="directory-metrics">
                    <div>
                      <dt>선택 기간 표본</dt>
                      <dd>
                        {p.games}경기
                        {p.games < Number(value("window", "10"))
                          ? " · 선택 경기 수 미달"
                          : " · 선택 경기 수 충족"}
                      </dd>
                    </div>
                    <div>
                      <dt>{p.role === "hitter" ? "OPS" : "ERA"}</dt>
                      <dd>
                        {(p.role === "hitter" ? p.ops : p.era)?.toFixed(3) ??
                          (p.role === "hitter"
                            ? "필수 기록 항목 누락"
                            : "투구 아웃 표본 없음")}
                      </dd>
                    </div>
                    <div>
                      <dt>전체 기세</dt>
                      <dd>
                        {p.score?.toFixed(1) ??
                          "산출 불가: 유효 기세 스냅샷 없음"}
                      </dd>
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
            <label>
              페이지 바로 이동
              <select
                value={String(result.page)}
                onChange={(e) => change("page", e.target.value)}
              >
                {Array.from({ length: result.pages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} / {result.pages}
                  </option>
                ))}
              </select>
            </label>
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
