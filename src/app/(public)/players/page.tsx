import { Suspense } from "react";
import { PlayerDirectory } from "@/components/features/player-directory";
export const metadata = {
  alternates: { canonical: "/players" },
  title: "가상 선수 탐색",
};
export default function Page() {
  return (
    <Suspense fallback={<p role="status">선수 검색 조건을 불러오는 중…</p>}>
      <PlayerDirectory />
    </Suspense>
  );
}
