import { operations } from "@/server/observability/service";
export async function Operations() {
  const report = await operations();
  return (
    <section aria-labelledby="operations-title">
      <h2 id="operations-title">운영 관측 · DEMO</h2>
      <p>
        관측 시각 {report.observedAt} · 최근 게시 성공{" "}
        {report.lastSuccess ?? "없음"}
      </p>
      <p>
        최근 1시간 API 표본 {report.requests.sampleSize} · P50{" "}
        {report.requests.p50Ms ?? "미측정"} ms · P95{" "}
        {report.requests.p95Ms ?? "미측정"} ms · 5xx 비율{" "}
        {report.requests.apiErrorRate ?? "미측정"} · 작업 실패{" "}
        {report.requests.scheduledJobFailures}
      </p>
      <h3>감지 및 조치</h3>
      {report.alerts.length ? (
        <ul>
          {report.alerts.map((a) => (
            <li key={a.code}>
              {a.code} ({a.count}) — {a.action}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          현재 규칙에서 감지한 경고 없음. 미측정 항목의 정상 여부는 확인되지
          않았습니다.
        </p>
      )}
      <h3>공개 게시 데이터셋</h3>
      {!report.datasets.length && <p>게시된 데이터가 없습니다.</p>}
      {report.datasets.map((d) => (
        <article key={`${d.season}-${d.competition}`}>
          <h4>
            {d.season} / {d.competition}
          </h4>
          <p>
            {d.sourceMode} · {d.licenseStatus} · 출처 {d.sourceIds.join(", ")} ·
            표본 {d.sampleSize}행
          </p>
          <p>
            업데이트 {d.lastUpdated ?? "없음"} · 최신 확정 경기{" "}
            {d.latestGameDate ?? "없음"} · 확정 {d.finalGames}경기 · 시즌 완성도
            미확인: {d.completenessReason}
          </p>
        </article>
      ))}
      <details>
        <summary>가져오기 실행·점수 분포 상세</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(
            { runs: report.runs, scores: report.scores },
            null,
            2,
          )}
        </pre>
      </details>
      <p>
        새로고침하여 최신 상태를 확인하세요. 자동 스케줄러·외부 알림 전송은
        설정되지 않았습니다.
      </p>
    </section>
  );
}
