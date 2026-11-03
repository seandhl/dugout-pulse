import { Operations } from "@/components/admin/operations";
import { headers } from "next/headers";
import { assertAdmin } from "@/server/ingest/admin";
import type { Metadata } from "next";
import { IngestForm } from "@/components/admin/ingest-form";
export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  assertAdmin(
    new Request(`${process.env.ADMIN_ORIGIN ?? "http://disabled"}/admin`, {
      headers: await headers(),
    }),
  );
  return (
    <section>
      <span className="eyebrow">RESTRICTED AREA</span>
      <h1>기록 가져오기</h1>
      <p>
        운영 관리자 권한 없이는 서버가 업로드를 차단합니다. 현재는 제공된 샘플만
        검증하며 관리자의 명시적 게시 승인 후 DEMO 공개 기록에 반영합니다.
      </p>
      <Operations />
      <IngestForm />
    </section>
  );
}
