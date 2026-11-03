# DEMO 운영 관측

외부 데이터를 수집하지 않는다. `/admin`의 **운영 관측 · DEMO**와 관리자 전용 `GET /api/admin/operations`가 현재 파일 게시 저장소를 검사한다. 기존 관리자 내부 origin·ADMIN 세션 검증이 선행된다. 공개 API에는 운영 보고서와 원본을 노출하지 않는다. 이 관측 범위는 파일 게시 저장소다. 기본 SQLite DEMO 화면 데이터는 별도 저장소이므로 이 보고서로 전체 화면의 최신성을 단정하지 않는다.

## 확인 및 실행

1. 기존 `docs/INGEST.md`의 관리자 설정으로 로그인한 뒤 `/admin`에 접근한다. 새로고침할 때 저장된 상태를 재검사한다. 게시가 없으면 DATASET_EMPTY와 빈 데이터 안내를 확인한다.
2. source mode, DEMO 전용 license status, 시즌·대회, source IDs, last updated(원천 as-of 최댓값), 최신 FINAL 경기 날짜, 표본 행 수를 확인한다. last success는 마지막 성공한 게시 실행 시각이다. 전체 시즌 분모가 없으므로 완성도는 항상 미확인이다. 로컬 self-authored DEMO 승인 상태는 외부 라이선스 승인을 의미하지 않는다.
3. 가져오기 실행 상세에서 상태·durationMs·rowsImported·invalid·duplicates를 확인한다. duration은 검증/게시 transaction의 계산 시간이며 디스크 commit 대기와 업로드 시간을 포함하지 않는다. 이전 run의 duration은 null이다. 검증만 한 행은 imported=0이다. 파서·권한·lock·commit 이전 실패는 run에 저장되지 않을 수 있으므로 API 오류 지표도 함께 확인한다.
4. 구조화 경고를 발생시키려면 동일 origin의 인증된 관리자 세션으로 `POST /api/admin/operations`를 실행한다. body는 필요 없다. 요청 권한은 GET과 같고 POST에는 Origin 헤더가 필요하다. 검사 중 예외는 job 실패로 기록되고 요청은 실패한다. 경고가 존재하는 정상 검사는 job 실행 성공이며 보고서 alerts로 구분한다.

자동 scheduler는 설치하지 않았다. 운영자가 승인한 scheduler에서 동일 검사 함수를 `observeJob`으로 감싸 실행하거나 관리자 인증 정책을 충족하는 POST를 호출하도록 연결할 수 있다. 인증을 우회하거나 비밀을 URL에 넣지 않는다. 실행되지 않은 job과 프로세스 자체 중단은 내부 관측으로 발견할 수 없으므로 배포 환경의 별도 생존 감시가 필요하다. 외부 메시지 발송은 구현하지 않았다.

## 경고와 조치

| 코드 | 기본 규칙 | 조치 |
| --- | --- | --- |
| DATASET_EMPTY / DATASET_STALE | 게시 없음 / as-of 누락·잘못된 날짜·48시간 초과 | 시즌·대회·비시즌 여부 확인 → 마지막 실행 확인 → 승인된 DEMO 파일 검증·게시. 신선도와 실제 경기 진행 여부를 구분한다. |
| H_GT_AB / NEGATIVE_RECORD / EXTRA_BASE_GT_H | H > AB / 음수 수치 / 2B+3B+HR > H | 게시 중지 → 검증 오류 행과 승인된 원천 대조 → 정정 재검증 → 게시 또는 최신 게시 롤백 |
| DUPLICATE_GAME | 시즌·대회·날짜·홈·원정·더블헤더 번호 동일 | ID 재사용 및 더블헤더 구분 확인. 서로 다른 경기를 삭제하여 맞추지 않는다. |
| BF_OUTS_REVIEW | BF < outs | 병살·삼중살·주루 아웃으로 정상일 수 있다. 원천 사건 확인 후 판단하며 자동 정정하지 않는다. |
| LICENSE_UNVERIFIED | DEMO 출처·라이선스 ID 또는 시즌·대회 불일치 | 공개 중단, 승인 범위와 저장 상태 복구 |
| MISSING_SOURCE | 공개 record의 sourceId 빈 값 | 출처 매핑 및 계약 확인, 복구 전 게시 중단 |
| IMPORT_REJECTED | 보존된 실행 중 REJECTED 존재 | 배치 검증 보고서 수정 후 재검증. 역사적 실패는 해결 후에도 이력으로 남으므로 현재 장애와 구분 |
| SCORE_NONFINITE / SCORE_RANGE | null 이외 NaN·Infinity / 0~100 밖 | 점수 노출 중지 검토, 계산 입력과 버전 확인 후 재계산·롤백 |
| ROLE_MIX | 역할과 계산 explanation scope 또는 windowBasis 불일치 | 타자·선발·불펜 매핑 및 계산 경로 확인. 원시 feature가 실제로 올바른 역할에서 왔는지를 증명하는 완전한 의미 검사는 아님 |
| SCORE_EXTREME_SURGE | 0/100 비율 +20%p | 경계값 처리와 표본 변화 확인 |
| SCORE_UNCALCULATED_SURGE | null 비율 +20%p | 표본 부족·휴식·결장·로스터·누락 필드를 확인. 정상 제외 사유를 숨기지 않음 |
| SCORE_DISTRIBUTION_SHIFT | 5개 20점 구간의 total variation ≥0.4 | 데이터·모델·표본 구성 변화 확인 |
| API_ERROR_RATE / REQUEST_SLOW | 1시간 표본 ≥20, 5xx ≥5% / P95 ≥1000ms | 저장소 I/O, 부하, 최근 배포 확인 후 복구 |
| JOB_FAILURE | 최근 1시간 wrapper가 관측한 실패 ≥1 | 실행 환경·게시 상태 확인 후 재시도. 게시 멱등성과 중복 실행 방지 확인 |

점수 비교는 같은 시즌·대회·역할·window·알고리즘의 직전 낮은 게시 revision을 사용하며 현재/기준선 각각 20개 이상일 때만 비율·분포 경고를 낸다. 기준선이나 표본 부족은 comparisonAvailable=false로 드러낸다. 역할·경기·기간을 합쳐 분포를 비교하지 않는다. NaN은 JSON으로 저장하면 null로 변환될 수 있으므로 원시 수치 NaN 검사는 순수 규칙 입력에서만 보장된다. 저장된 null은 미계산 비율에 반영된다.

## 로그·성능 범위와 개인정보

모든 현재 API route handler를 observeRequest로 감싼다. P50/P95는 handler 응답 생성까지의 소요 시간(최근 1시간, nearest-rank)이며 네트워크 전송·페이지 렌더 시간은 제외한다. 5xx와 4xx 비율을 분리한다. route·query·body·헤더·쿠키·IP·actor·예외 메시지는 기록하지 않는다. 원본 업로드 전체나 인증키를 telemetry에 전달하지 않는다. 허용된 이벤트 종류·시각·상태·기간·고정 경고 코드·집계 개수만 직렬화한다.

기본 adapter는 stdout 구조화 로그와 `.demo/observability/events.jsonl`(디렉터리 0700/파일 0600)에 집계를 저장한다. 대시보드는 마지막 2 MiB/10,000건 이내만 읽으므로 고부하에서는 1시간 전체가 아닌 부분 표본이다. null 지표는 정상값 0이 아니다. 단일 호스트 파일 집계이며 재배포/파일 삭제 시 이력이 사라진다. 로그 쓰기 실패는 `telemetry_write_failed`를 stderr에 남기고 사용자 응답은 유지한다. 운영자는 디스크 사용량을 확인하고 프로세스를 중지한 유지보수 시간에 로그를 rotate/삭제한다. 자동 보존 정책과 rotation은 미구현이다. 기존 업로드 저장소와 audit 로그는 별개이며 공개 공유 대상이 아니다.

`AlertAdapter.emit(Alert)`를 구현하면 별도 운영 도구에 연결할 수 있다. `inspect()`는 I/O 없는 규칙이고 `dispatch()`는 adapter 호출만 담당한다. 대시보드는 조회마다 알림을 전송하지 않는다. 명시적 POST는 매번 경고를 기록하므로 외부 adapter 도입 시 중복 억제/해결 알림 정책도 구성해야 한다.

## 실패 재현과 검증

`tests/unit/observability.test.ts`의 self-authored fixture는 오래된 날짜, H>AB, 음수 BB, 장타 합계 초과, BF/outs, 중복 게임, 출처 누락을 실제 규칙에 넣는다. 이전 40개 50점에서 현재 null/100/NaN 및 잘못된 역할 기준으로 바꾸어 점수 경고를 재현한다. adapter 호출, P50/P95/오류율, 예외를 던지는 job 실패, 로그의 비밀/원본 예외 비포함을 검증한다. 실제 선수 기록이 아니며 공개 게시하지 않는다.

- `./node_modules/.bin/vitest run tests/unit/observability.test.ts tests/unit/pipeline.test.ts`: 최초 12개 통과. 이후 관리자 권한·계산 scope 혼합 검증을 추가했다.
- 전체 테스트·lint·타입 검사 최종 결과는 작업 보고를 따른다. 문서 검증을 앱 실행 성공으로 해석하지 않는다.
- 관리자 실화면, 실제 scheduler/외부 알림, 다중 인스턴스 집계 검증은 포함하지 않는다.

장애 복구 완료는 경고 수 감소만으로 판단하지 않는다. 정정 입력 검증 → 공개 시즌·대회와 출처 확인 → 재계산 결과/제외 사유 확인 → API 오류율과 fresh as-of 확인 순으로 검토한다. 롤백은 기존 관리자 ingest 도구로 최신 게시만 수행한다.

최종 실행 결과 (2026-11-03): `vitest run --testTimeout=20000`은 21개 파일/217개 테스트 통과. 기본 5초 제한 전체 실행은 기존 momentum-snapshots 테스트 1개 시간 초과였다. 변경 파일 ESLint 통과. `tsc --noEmit`은 기존 `prisma.config.ts`의 `prisma/config` 모듈 미설치로 실패하여 타입 검사 전체 통과를 선언하지 않는다. 패키지는 설치하지 않았다. 실화면 브라우저 확인과 production build는 수행하지 않았다 (관리자 인증 환경 미구성 및 타입 검사 선행 오류).


### 대량 DEMO 성능 재현

`DEMO_PROFILE=performance pnpm db:seed`는 600명 snapshot을 별도 프로세스에서 준비한다. 같은 DEMO_PROFILE로 서버를 실행해야 한다. 일반 개발로 돌아갈 때는 서버를 종료한 뒤 `pnpm db:seed`로 기본 fixture를 복원한다. 기존 SQLite DB는 seed가 snapshot 테이블/열을 추가하며 snapshot 없는 DB의 홈/검색은 503으로 seed 필요를 안내한다. 요청 중 재계산 fallback은 없다.

seed 실패 시 기존 공개 release가 유지된다. 역할/기간별 배치는 최대 3회 재시도하며 프로세스 재실행은 결정적·멱등이다. 프로세스 강제 종료 후 자동 재개나 외부 큐는 제공하지 않는다. 파일 게시 lock이 비정상 종료로 남으면 실행 중 작업이 없는지 확인한 후 기존 복구 절차를 따른다. 자동 lock 강탈은 하지 않는다. 측정/제한/비용 모델은 PERFORMANCE.md를 따른다.
