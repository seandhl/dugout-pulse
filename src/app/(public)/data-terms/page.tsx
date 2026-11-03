export const metadata = {
  alternates: { canonical: "/data-terms" },
  title: "데이터 이용 안내",
};
export default function Page() {
  return (
    <article className="prose">
      <span className="badge">출시 전 초안</span>
      <h1>데이터 이용 안내</h1>
      <p>
        출시 전 검토용 placeholder입니다. 현재 자체 제작 합성 DEMO 데이터만
        제공합니다. 공식 KBO 기록이나 실제 선수 평가로 사용하지 마세요. 데이터
        공급 계약·재배포·사진·로고·상표 이용 권한은 취득한 것으로 간주하지
        않습니다. CSV는 DEMO 또는 서버가 내보내기를 승인한 출처에 한해
        제공합니다. 실제 데이터 도입 전 이용 허용 범위·보유 기간·삭제
        절차·권리자·문의 창구를 확정해야 합니다.
      </p>
      <p>
        최종 시행일: 미정 · 실제 데이터 공개 전에 법률·운영 검토가 필요합니다.
      </p>
    </article>
  );
}
