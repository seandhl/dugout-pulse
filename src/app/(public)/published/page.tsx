export const metadata = { alternates: { canonical: "/published" } };
import { pipeline } from "@/server/ingest/pipeline";
import { kstDate, scopeInput } from "@/server/reads/scope";
export const dynamic = "force-dynamic";
export default async function PublishedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = scopeInput.safeParse({
    season: Number(kstDate(new Date().toISOString()).slice(0, 4)),
    ...params,
  });
  if (!parsed.success) return <p>날짜·시즌·조회 조건을 확인하세요.</p>;
  const result = await pipeline.scope(parsed.data);
  return (
    <section>
      <h1>날짜별 1군 기록 · DEMO</h1>
      <p>
        자체 제작 샘플 · 공식 선수 기록이 아닙니다. 수동 import · 일정과 기록
        기준시각을 표시합니다.
      </p>
      <form>
        <label>
          시즌{" "}
          <input
            name="season"
            type="number"
            min="1900"
            max="9999"
            defaultValue={result.season}
            list="seasons"
          />
        </label>
        <datalist id="seasons">
          {result.availableSeasons.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <label>
          대회{" "}
          <select name="competition" defaultValue={result.competition}>
            <option value="regular">정규시즌</option>
            <option value="postseason">포스트시즌</option>
            <option value="allstar">올스타</option>
            <option value="exhibition">시범경기</option>
          </select>
        </label>
        <label>
          조회일(KST){" "}
          <input name="date" type="date" defaultValue={result.date} />
        </label>
        <label>
          검색 범위{" "}
          <select name="search" defaultValue={result.search}>
            <option value="appeared">1군 출전 선수</option>
            <option value="registered">조회일 등록 선수</option>
          </select>
        </label>
        <label>
          선수명 <input name="q" defaultValue={result.q} />
        </label>
        <button type="submit">조회</button>
      </form>
      <p>
        {result.rosterMessage} · 스냅샷 기준일:{" "}
        {result.snapshotAsOfDate ?? "없음"}
      </p>
      <p>
        데이터 기준시각: {result.asOf ?? "없음"} ·{" "}
        {result.stale ? "갱신 확인 필요" : "갱신 기준 이내"} · 임계값{" "}
        {result.policy.staleThresholdHours}시간
      </p>
      <p>
        최근 시도: {result.pipeline.lastAttempted ?? "없음"} · 최근 게시 성공:{" "}
        {result.pipeline.lastSuccessful ?? "없음"} · 자동 갱신 비활성 · 알림
        미연결
      </p>
      <h2>선수 검색</h2>
      {result.players.length === 0 ? (
        <p>조회 가능한 선수가 없습니다.</p>
      ) : (
        <ul>
          {result.players.map((p) => (
            <li key={String(p.row.player_id)}>
              {String(p.row.display_name)} · 마지막 출전일{" "}
              {p.lastAppearanceDate ?? "없음"} · 표본 {p.sampleSize}경기 · 기록
              시점 {p.dataAsOf ?? "없음"}
            </li>
          ))}
        </ul>
      )}
      <h2>조회일 경기 일정·상태</h2>
      {result.games.length === 0 ? (
        <p>해당 날짜의 경기 정보 없음</p>
      ) : (
        <ul>
          {result.games.map((g) => (
            <li key={String(g.row.game_id)}>
              {String(g.row.game_id)} · {String(g.row.scheduled_at_kst)} ·{" "}
              {String(g.row.status)}
            </li>
          ))}
        </ul>
      )}
      <h2>조회일 경기 로그</h2>
      <p>{result.gameLogs.length}행 · 로스터 스냅샷과 별도로 조회합니다.</p>
      <ul>
        {result.gameLogs.map((log) => (
          <li
            key={`${log.kind}-${String(log.row.game_id)}-${String(log.row.player_id)}`}
          >
            {String(log.row.player_id)} ·{" "}
            {log.kind === "batting_game_logs"
              ? `안타 ${String(log.row.h)} · 타석 ${String(log.row.pa)}`
              : `아웃 ${String(log.row.outs)}`}{" "}
            · 기준시각 {String(log.row.as_of)}
          </li>
        ))}
      </ul>
      <details>
        <summary>로스터·소속팀 이력·원천 참조</summary>
        <pre>
          {JSON.stringify(
            {
              snapshots: result.rosterSnapshots,
              teamHistory: result.teamHistory,
              gameLogs: result.gameLogs,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>수동 import 실행 이력</summary>
        <pre>{JSON.stringify(result.pipeline.runs, null, 2)}</pre>
      </details>
    </section>
  );
}
