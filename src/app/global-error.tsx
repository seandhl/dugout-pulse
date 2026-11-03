"use client";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main>
          <h1>앱을 불러오지 못했습니다</h1>
          <p>다시 시도해 주세요.</p>
          <button onClick={reset}>다시 시도</button>
        </main>
      </body>
    </html>
  );
}
