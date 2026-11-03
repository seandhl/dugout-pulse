export const metadata = {
  alternates: { canonical: "/privacy" },
  title: "개인정보 처리 안내",
};
export default function Page() {
  return (
    <article className="prose">
      <span className="badge">출시 전 초안</span>
      <h1>개인정보 처리 안내</h1>
      <p>
        출시 전 검토용 placeholder입니다. 현재 회원 가입·광고·분석 도구는
        제공하지 않습니다. 테마 선택은 브라우저 localStorage에 저장되며 브라우저
        사이트 데이터 삭제로 지울 수 있습니다. 검색 조건은 URL에 남으므로
        개인정보를 입력하지 마세요. 호스팅 접속 로그의 수집 항목·보유
        기간·처리자·문의 창구는 배포 환경 확정 후 기재해야 합니다.
      </p>
      <p>
        최종 시행일: 미정 · 실제 데이터 공개 전에 법률·운영 검토가 필요합니다.
      </p>
    </article>
  );
}
