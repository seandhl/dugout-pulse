"use client";
import { useSyncExternalStore, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
const kinds = [
  "players",
  "games",
  "batting_game_logs",
  "pitching_game_logs",
  "rosters",
] as const;
const subscribeReady = () => () => {};
export function IngestForm() {
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const [kind, setKind] = useState<string>("players");
  const [variant, setVariant] = useState("example");
  const [approved, setApproved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<null | {
    importBatchId: string;
    status: string;
    rowCount: number;
    sampleSize: number;
    checksum: string;
    sourceId: string;
    licenseId: string;
    schemaVersion: string;
    counts: Record<string, number>;
    published?: boolean;
    issues: {
      row: number;
      severity: string;
      code: string;
      fields: string[];
      message?: string;
    }[];
  }>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setReport(null);
    setApproved(false);
    if (!file || file.size > 5 * 1024 * 1024) {
      setMessage("5 MiB 이하 샘플 파일을 선택하세요.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: {
          "Content-Type": file.name.endsWith(".csv")
            ? "text/csv"
            : "application/json",
          "X-Ingest-Kind": kind,
          "X-File-Name": file.name,
        },
        body: file,
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) setMessage(result.error ?? "업로드 실패");
      else setReport(result);
    } catch {
      setMessage(
        "연결이 끊겼거나 요청 시간이 초과되었습니다. 비공개 staging에 저장되었을 수 있습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <button
        type="button"
        onClick={async () => {
          const response = await fetch("/api/admin/session", {
            method: "DELETE",
          });
          if (response.ok) router.replace("/admin/login");
          else setMessage("로그아웃 실패");
        }}
      >
        로그아웃
      </button>
      <p>DEMO · 자체 제작 샘플 전용 · 업로드 후에도 미공개</p>
      <form onSubmit={submit}>
        <p>
          <label>
            기록 종류{" "}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setReport(null);
              }}
            >
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            샘플 시나리오{" "}
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
            >
              <option value="example">정상</option>
              <option value="errors">필수값 누락</option>
              <option value="duplicates">중복 행</option>
              {kind === "batting_game_logs" && (
                <option value="correction">안타 정정</option>
              )}
            </select>
          </label>
        </p>
        <p>
          <a
            href={`/api/admin/ingest/templates?kind=${kind}&format=csv&variant=${variant}`}
          >
            CSV 예제 템플릿 다운로드
          </a>
          {" · "}
          <a
            href={`/api/admin/ingest/templates?kind=${kind}&format=json&variant=${variant}`}
          >
            JSON 예제 템플릿 다운로드
          </a>
        </p>
        <p>
          <label>
            샘플 파일 (UTF-8, 최대 5 MiB){" "}
            <input
              disabled={!ready}
              type="file"
              accept=".csv,.json"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </p>
        <button disabled={busy || !file} type="submit">
          {busy ? "서버 검증 중…" : "업로드 및 dry-run 검증"}
        </button>
      </form>
      <p role="status">
        {message ||
          (!report && !busy
            ? "템플릿을 다운로드하고 관리자 권한으로 업로드하세요."
            : "")}
      </p>
      {report && (
        <section aria-live="polite">
          <h2>검증 리포트 · 아직 미공개</h2>
          <p>
            상태: {report.status} ·{" "}
            {report.published ? "게시 완료" : "게시 불가"}
          </p>
          <p>
            게시 시 선수 → 경기 → 날짜별 로스터 → 출전 기록 순서로 참조를
            확인합니다. 게시 전 권리 체크리스트를 확인하세요.
          </p>
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            수집권·보관권·공개권·2차 가공권·수출권을 모두 확인했습니다 (DEMO
            자체 제작 계약).
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !approved ||
              report.status !== "VALIDATED" ||
              report.published
            }
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch("/api/admin/ingest/publish", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    batchId: report.importBatchId,
                    approve: true,
                    checklist: {
                      collect: approved,
                      store: approved,
                      display: approved,
                      transform: approved,
                      export: approved,
                    },
                  }),
                  signal: AbortSignal.timeout(15000),
                });
                const result = await response.json();
                if (result.report)
                  setReport({ ...result.report, published: result.published });
                setMessage(
                  result.published
                    ? "관리자 승인으로 공개되었습니다."
                    : (result.error ??
                        "게시 검증 실패: 행별 오류를 확인하세요."),
                );
              } catch {
                setMessage("연결 실패. 공개 결과에서 게시 여부를 확인하세요.");
              } finally {
                setBusy(false);
              }
            }}
          >
            이 배치 공개 게시 승인
          </button>
          <button
            type="button"
            disabled={busy || !report.published}
            onClick={async () => {
              if (!window.confirm("최신 DEMO 게시를 되돌리겠습니까?")) return;
              setBusy(true);
              try {
                const response = await fetch("/api/admin/ingest/rollback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    batchId: report.importBatchId,
                    confirmation: "ROLLBACK DEMO",
                  }),
                });
                const result = await response.json();
                setMessage(response.ok ? "되돌리기 완료" : result.error);
                if (response.ok) setReport({ ...report, published: false });
              } catch {
                setMessage("되돌리기 연결 실패");
              } finally {
                setBusy(false);
              }
            }}
          >
            최신 DEMO 게시 되돌리기
          </button>
          <p>
            <a href="/published">승인된 DEMO 집계 확인</a>
          </p>
          <dl>
            {Object.entries(report.counts).map(([k, v]) => (
              <div key={k}>
                <dt>
                  {{
                    new: "신규",
                    deleted: "삭제 예상 (경기 취소 등)",
                    updates: "업데이트",
                    duplicates: "중복",
                    errors: "오류",
                    warnings: "경고",
                  }[k] ?? k}
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <ul>
            {report.issues.map((issue, i) => (
              <li key={i}>
                {issue.row}행 · {issue.severity} · {issue.code} ·{" "}
                {issue.fields.join(", ")} · {issue.message}
              </li>
            ))}
          </ul>
          <p>
            파일: {file?.name} · 전체 {report.rowCount}행 · 유효 표본{" "}
            {report.sampleSize} · 삭제 예상은 아래 검증 수치를 확인하세요
          </p>
          <p>
            출처/계약 상태: APPROVED · DEMO 자체 제작 전용 · 실데이터
            import/삭제 차단
          </p>
          <p>배치: {report.importBatchId}</p>
          <p style={{ overflowWrap: "anywhere" }}>SHA-256: {report.checksum}</p>
          <p>
            출처: {report.sourceId} · 라이선스: {report.licenseId} · 스키마:{" "}
            {report.schemaVersion}
          </p>
        </section>
      )}
    </div>
  );
}
