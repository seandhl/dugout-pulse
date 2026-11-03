"use client";
export default function RankingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel" role="alert">
      <h1>랭킹을 불러오지 못했습니다</h1>
      <p>
        오프라인이라면 연결을 확인한 뒤 다시 시도해 주세요. 저장된 기록을 확인할
        수 없어 점수를 표시하지 않습니다.
      </p>
      <button className="button" onClick={reset}>
        다시 시도
      </button>
    </section>
  );
}
