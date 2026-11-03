import Link from "next/link";
import { boardQuery } from "@/contracts/ranking-boards";
import { pipeline } from "@/server/ingest/pipeline";
import { selectRankingBoards } from "@/server/reads/ranking-boards";
export const metadata = {
  alternates: { canonical: "/rankings" },
  title: "기세 랭킹",
};
export const dynamic = "force-dynamic";
const labels = { hitter: "타자", starter: "선발", reliever: "불펜" };
const tips: Record<string, string> = {
  OBP: "출루율: (H+BB+HBP)/(AB+BB+HBP+SF)",
  ISO: "순장타율: (총루타−안타)/타수",
  KRate: "삼진율: SO/PA",
  KMinusBB: "탈삼진−볼넷 비율: (SO−BB)/BF",
  WHIP: "이닝당 출루 허용: 3×(H+BB)/아웃",
  OutsPerStart: "선발 등판당 기록 아웃 수",
  HRRate: "피홈런율: HR/BF",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = boardQuery.safeParse(raw);
  if (!parsed.success)
    return (
      <section className="panel">
        <h1>유효하지 않은 랭킹 조건</h1>
        <p>중복 조건, 날짜, 시즌, 기간 또는 페이지를 확인해 주세요.</p>
        <Link href="/rankings">조건 초기화</Link>
      </section>
    );
  const q = parsed.data;
  const result = selectRankingBoards(await pipeline.readPublicState(), q);
  function href(patch: Record<string, string>) {
    const params = new URLSearchParams({
      season: String(q.season),
      competition: q.competition,
      window: q.window,
      date: result.date,
      sort: q.sort,
      ...(q.team ? { team: q.team } : {}),
      ...patch,
    });
    return `/rankings?${params}`;
  }
  return (
    <>
      <div className="page-heading">
        <span className="badge">DEMO</span>
        <h1>기세 랭킹</h1>
        <p>게시된 역할별 스냅샷 · 실제 선수 공식 기록이 아닙니다.</p>
        <p>
          기세 0–100은 절대 실력·승리확률이 아닙니다. 타자·선발·불펜 점수는 직접
          비교하지 않습니다. 오늘 경기 예측이 아닌 선택 기준일의 최근 출전
          요약입니다.
        </p>
        <p>
          DEMO는 2026 정규시즌만 지원합니다. 다른 시즌·대회는 기록 없음으로
          표시합니다.
        </p>
      </div>
      <form className="panel directory-filters" action="/rankings">
        <label>
          시즌
          <input
            name="season"
            type="number"
            min="1900"
            max="9999"
            defaultValue={q.season}
          />
        </label>
        <label>
          대회
          <select name="competition" defaultValue={q.competition}>
            <option value="regular">정규시즌</option>
            <option value="postseason">포스트시즌</option>
          </select>
        </label>
        <label>
          기간 N
          <select name="window" defaultValue={q.window}>
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                최근 {n}출전/역할 등판
              </option>
            ))}
          </select>
        </label>
        <label>
          기준일 (KST)
          <input name="date" type="date" defaultValue={result.date} />
        </label>
        <label>
          전체 최근 표본 내 소속 이력
          <select name="team" defaultValue={q.team ?? ""}>
            <option value="">전체 팀</option>
            {[...new Set([...result.teams, ...(q.team ? [q.team] : [])])].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <input type="hidden" name="sort" value={q.sort} />
        <button className="button" type="submit">
          조건 적용
        </button>
        <Link href="/rankings">초기화</Link>
      </form>
      <nav className="directory-pagination" aria-label="랭킹 정렬">
        {(
          [
            ["score", "기세 점수 TOP"],
            ["change", "최근 변화 TOP"],
            ["decline", "하락 변화"],
          ] as const
        ).map(([sort, label]) => (
          <Link
            key={sort}
            className="button"
            href={href({ sort })}
            aria-current={q.sort === sort ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p>
        기준일 {result.date} (KST) · {q.season}{" "}
        {q.competition === "regular" ? "정규시즌" : "포스트시즌"} ·
        scoringVersion {result.scoringVersion} · 게시 revision {result.revision}
      </p>
      <p>
        현재 URL을 복사하면 필터·정렬·페이지를 공유할 수 있습니다. 점수와 변화는
        반올림 전 원값으로 정렬합니다. 점수·상승은 내림차순, 하락은
        오름차순이며, 원값이 정확히 같으면 공동 순위(1,1,3), 표시 순서는 선수
        ID순입니다. 페이지가 바뀌어도 공동 순위를 유지합니다. 소수 첫째 자리
        표시가 같아도 원값이 다르면 순위가 다릅니다. 변화는 같은
        선수·시즌·대회·역할·기간·모델 버전의 이전 순위 적격 게시 점수 대비이며,
        상승/하락 탭은 각각 원값이 양수/음수인 경우만 (0·비교 없음 제외)
        표시합니다.
      </p>
      <p>
        팀 선택은 전체 최근 표본에 해당 팀 소속 출전 이력이 있는 선수만
        필터합니다. 팀 필터 후에도 전체 기세 점수이며 표본·핵심 지표·최근
        출전일도 전체 기록입니다. 팀별 기록은 선수 탐색에서 확인하세요. 랭킹은
        등록 확인·중간 이상 신뢰도만 포함합니다. 타자: 3출전·30 PA 이상, 선발:
        2등판·75 BF·45아웃 이상, 불펜: 3등판·30 BF·18아웃 이상. 최소 계산 표본을
        통과해도 신뢰도가 낮으면 제외합니다.{" "}
        <Link href="/about#momentum-formula">평점 공식과 역할별 지표 설명</Link>
      </p>
      {result.stale && (
        <section className="panel" role="status">
          <h2>기록 미갱신</h2>
          <p>
            선택 기준일에 동일 계산 버전의 완전한 게시 스냅샷이 없습니다. 다른
            날짜·버전의 점수를 대신 표시하지 않습니다.
          </p>
        </section>
      )}
      {result.boards.map((board) => (
        <section
          className="panel"
          key={board.role}
          aria-label={`${labels[board.role]} 랭킹`}
        >
          <h2>{labels[board.role]} 보드</h2>
          <p>
            최근 {q.window}
            {board.role === "hitter"
              ? "타격 출전"
              : board.role === "starter"
                ? "선발 등판"
                : "구원 등판"}{" "}
            · {board.total}명 · 표본 부족·등록 미확인·산출 보류 제외{" "}
            {board.excluded}명 · 이전 유효 게시 없음 {board.noPrevious}명
          </p>
          {!board.rows.length ? (
            <p>
              {result.stale
                ? "기록 미갱신"
                : "조건을 만족하는 랭킹 기록이 없습니다."}
            </p>
          ) : (
            <div
              className="ds-table-wrap"
              role="region"
              aria-label={`${labels[board.role]} 랭킹 표 가로 스크롤`}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Enables keyboard scrolling of wide ranking tables.
              tabIndex={0}
            >
              <table>
                <caption>
                  {labels[board.role]} · {board.page}/{board.pages}페이지
                </caption>
                <thead>
                  <tr>
                    {[
                      "순위 / 선수",
                      "점수 / 변화",
                      "신뢰도 / 표본",
                      "최근 핵심 지표",
                      "마지막 출전·등판 / 출처",
                    ].map((t) => (
                      <th key={t} scope="col">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.rank}.{" "}
                        <Link
                          href={`/players/${s.playerId}?season=${q.season}&competition=${q.competition}&snapshot=${s.id}`}
                        >
                          {s.name}
                        </Link>
                        <p>{s.teams.join(", ") || "소속 미상"}</p>
                      </td>
                      <td>
                        {s.score?.toFixed(1)} /{" "}
                        {s.deltaScore === null ? (
                          <span className="metric-na">N/A · 비교 없음</span>
                        ) : (
                          `${s.deltaScore > 0 ? "+" : ""}${s.deltaScore.toFixed(1)}`
                        )}
                        <details>
                          <summary title="같은 선수·시즌·대회·역할·기간·모델 버전의 이전 순위 적격 게시 점수 대비입니다.">
                            기세 변화량 비교 기준
                          </summary>
                          <p>
                            {s.season} {s.competition} · {s.role} · {s.window}
                            출전 · {s.modelVersion}
                          </p>
                          <p>
                            현재 {s.id} · {s.asOf}
                          </p>
                          <p>
                            이전{" "}
                            {s.comparisonBasis.previous
                              ? `${s.comparisonBasis.previous.snapshotId} · ${s.comparisonBasis.previous.asOf}`
                              : "게시 자료 없음 · 비교 불가"}
                          </p>
                        </details>
                      </td>
                      <td>
                        {s.confidence === "high" ? "높음" : "보통"} ·{" "}
                        {s.sampleSize}/{s.window}출전
                        <p>
                          {s.summary?.opportunities ?? "미상"}{" "}
                          {board.role === "hitter" ? "PA" : "BF"}{" "}
                          {board.role !== "hitter" &&
                            `· ${s.summary?.outs ?? "미상"}아웃`}
                        </p>
                      </td>
                      <td>
                        {Object.entries(s.summary?.metrics ?? {}).map(
                          ([name, m]) => (
                            <details key={name}>
                              <summary>
                                {name} {m.value?.toFixed(3) ?? "기록 없음"}
                              </summary>
                              {tips[name] ?? "지표 정의 미제공"}
                            </details>
                          ),
                        )}
                      </td>
                      <td>
                        {s.lastAppearance ?? "미상"}
                        <p>휴식·결장 사유 미확인</p>
                        <small>
                          {s.sourceIds.join(", ")} · 기준 {s.asOf} · 계산{" "}
                          {s.computedAt}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            className="directory-pagination"
            aria-label={`${labels[board.role]} 페이지`}
          >
            {board.page > 1 && (
              <Link href={href({ page: String(board.page - 1) })}>
                이전 페이지
              </Link>
            )}
            <span>
              {board.page} / {board.pages}
            </span>
            {board.page < board.pages && (
              <Link href={href({ page: String(board.page + 1) })}>
                다음 페이지
              </Link>
            )}
          </nav>
        </section>
      ))}
    </>
  );
}
