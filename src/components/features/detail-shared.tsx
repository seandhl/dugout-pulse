"use client";
import { formatKst } from "@/ui/format";
import Link from "@/components/release-provider";
import { useReleaseRouter } from "@/components/release-provider";

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
  const router = useReleaseRouter();
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
        <p>
          데이터 기준일 {formatKst(d.asOf)} · 출처 {d.source} · DEMO
        </p>
        <p>
          기세 0–100은 최근 기록 요약이며 절대 실력·승리확률이 아닙니다.
          타자·선발·불펜 점수는 직접 비교하지 않습니다.
        </p>
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
      <p>DEMO는 2026 정규시즌만 지원합니다.</p>
      {d.comparisonBasis && (
        <details>
          <summary title="최신 출전 하나를 제외한 N출전 이동 창과 비교합니다. 이전 게시 대비 기세 변화량과 다릅니다.">
            모델 내부 이동 창 점수차의 비교 기준
          </summary>
          <p>
            최신 출전 하나를 제외한 N출전 대비입니다. 두 창은 겹칩니다. 이전
            게시 대비 기세 변화량과 구분합니다. 표본·필수 기록이 부족하면 비교
            불가입니다.
          </p>
          <p>
            {d.comparisonBasis.current.season} 정규시즌 ·{" "}
            {d.comparisonBasis.current.role} ·{" "}
            {d.comparisonBasis.current.window}출전 · 모델{" "}
            {d.comparisonBasis.current.modelVersion} · 스냅샷{" "}
            {d.comparisonBasis.current.snapshotId} · 기준{" "}
            {d.comparisonBasis.current.asOf}
          </p>
          <p>
            현재 창 원천:{" "}
            {d.comparisonBasis.current.inputRefs.join(", ") || "없음"}
          </p>
          <p>
            이동 비교 창 원천:{" "}
            {d.comparisonBasis.previous?.inputRefs.join(", ") || "비교 불가"}
          </p>
        </details>
      )}
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
