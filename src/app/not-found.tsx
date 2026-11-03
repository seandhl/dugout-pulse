import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty panel">
      <span className="eyebrow">404 / NOT FOUND</span>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>주소를 확인하거나 선수 탐색으로 돌아가세요.</p>
      <Link className="button" href="/players">
        선수 탐색
      </Link>
    </section>
  );
}
