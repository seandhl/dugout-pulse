"use client";
import { formatKst } from "@/ui/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoNotice, PlayerAvatarFallback } from "@/components/ui";
import type { PlayerDetail } from "@/server/reads/player-detail";
import type { PitcherDetail } from "@/server/reads/pitcher-detail";
type Detail = PlayerDetail | PitcherDetail;
export function DetailHeader({
  d,
  id,
  roleLabel,
}: {
  d: Detail;
  id: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <>
      <nav aria-label="상세 작업" className="detail-actions">
        <Link href="/players">← 선수 목록으로</Link>
        <button
          onClick={() => {
            if (history.length > 1) router.back();
            else router.push("/players");
          }}
        >
          뒤로 이동
        </button>
        <Link href={`/compare?players=${id}`}>선수 비교에 추가</Link>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setMessage("URL을 복사했습니다.");
            } catch {
              setMessage(`공유 URL: ${location.href}`);
            }
          }}
        >
          URL 공유
        </button>
      </nav>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <DemoNotice />
      <header className="page-heading">
        <PlayerAvatarFallback label={d.player.displayName} />
        <h1>{d.player.displayName}</h1>
        <p>
          {d.team} · {roleLabel} · 포지션 미제공 · {d.seasonYear}{" "}
          {d.competition}
        </p>
        <p>
          현재 엔트리 여부 미확인 · 최근{" "}
          {!("roleSeason" in d) ? "출전" : "등판"} {d.lastAppearance ?? "없음"}
        </p>
      </header>
    </>
  );
}
export function DetailFooter({ d }: { d: Detail }) {
  return (
    <footer>
      <p>
        출처: {d.source} · DEMO · {d.seasonYear} {d.competition} · 표본{" "}
        {d.recent.sample.appearances}
        {!("roleSeason" in d) ? "출전" : "등판"}
      </p>
      <p>
        기준일 <time dateTime={d.asOf}>{formatKst(d.asOf)}</time> · 업데이트{" "}
        {formatKst(d.updatedAt)}
      </p>
      <details>
        <summary>가공 기록 원천 추적</summary>
        <ul>
          {d.games.map((g) => (
            <li key={g.id}>
              {g.id}: {g.source} · {g.inputRef} · {d.asOf}
            </li>
          ))}
        </ul>
      </details>
    </footer>
  );
}
