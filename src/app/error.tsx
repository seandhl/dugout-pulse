"use client";
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty panel">
      <h1>화면을 불러오지 못했습니다</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button className="button" onClick={reset}>
        다시 시도
      </button>
    </section>
  );
}
