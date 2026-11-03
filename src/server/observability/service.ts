import "server-only";
import { pipeline } from "../ingest/pipeline";
import { inspect, dispatch } from "./rules";
import { readMetrics, structuredLogAdapter } from "./runtime";
export async function operations(emit = false) {
  const report = inspect(await pipeline.read());
  const requests = await readMetrics();
  if (requests.sampleSize >= 20 && (requests.apiErrorRate ?? 0) >= 0.05)
    report.alerts.push({
      code: "API_ERROR_RATE",
      count: requests.sampleSize,
      action:
        "최근 1시간 5xx 5% 이상: 응답 코드와 서버 상태 확인, 최근 변경 복구",
    });
  if (requests.sampleSize >= 20 && (requests.p95Ms ?? 0) >= 1000)
    report.alerts.push({
      code: "REQUEST_SLOW",
      count: requests.sampleSize,
      action: "P95 1초 이상: 저장소 I/O·부하·최근 배포 확인",
    });
  if (requests.scheduledJobFailures)
    report.alerts.push({
      code: "JOB_FAILURE",
      count: requests.scheduledJobFailures,
      action: "작업 실행 환경과 게시 상태 확인 후 멱등성 검토·재시도",
    });
  if (emit) await dispatch(report.alerts, structuredLogAdapter);
  return { ...report, requests };
}
