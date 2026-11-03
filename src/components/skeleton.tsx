export function Skeleton() {
  return (
    <div role="status" aria-label="화면을 불러오는 중">
      <span className="sr-only">화면을 불러오는 중입니다.</span>
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton short" aria-hidden="true" />
    </div>
  );
}
