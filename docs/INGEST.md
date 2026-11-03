# 샘플 파일 ingest v1

2026-11-03 / DEMO 전용. 자체 제작 예제이며 실제 선수·KBO 공식 기록이 아니다.
관리자가 실제 데이터의 권리를 업로드 파일로 스스로 승인할 수 없다.
현재 신뢰 목록은 저장소의 `fixtures/ingest`에 있는 파일의 서버 측 SHA-256이다.
정상·필수값 누락(errors)·중복(duplicates) 예제를 제공한다. BOM 추가만 허용하며
내용을 수정한 파일은 422로 거부한다. 외부 수집·실제 데이터 연결은 없다. DEMO는 명시적 승인 후 공개할 수 있다.

## 관리자와 화면 실행

- 환경 변수 설정 후 내부 origin의 `/admin/login`에서 별도 발급 토큰으로 로그인한다. 구체적인 설정은 아래 관리자 운영 절을 따른다.
- PUBLIC은 화면·템플릿·업로드·게시·되돌리기 모두 거부한다. ADMIN 세션에서만 작업한다.
- 토큰은 로그인에서만 전송하며 브라우저 저장소·URL·로그에는 저장하지 않는다. 이후 요청은 HttpOnly 세션을 사용한다.
- UI에서 파일 내용은 읽거나 파싱하지 않고 크기만 확인한다. 서버가 다시 크기·형식·권한을 검증한다.
- 정상: VALIDATED, 누락: REJECTED, 중복: duplicates 증가. 모든 결과는 `published:false`,
  `publishAllowed:false`이며 공개 API가 읽지 않는 `.demo/ingest/<서버 UUID>.json`에 저장한다.
  오류가 있으면 배치 전체가 REJECTED다. 정상 행이 있어도 부분 게시할 수 없다.

## 파일 계약

CSV는 헤더 1행과 데이터 행, JSON은 행 객체 배열이다. UTF-8(BOM 허용)만 지원한다.
헤더 순서는 무관하다. 알 수 없는 필드는 오류이며 매핑 후 중복 헤더도 거부한다.
최대 5 MiB, 50,000행, CSV 32열/셀 2,048자. 헤더 외 빈 행도 오류다.
MIME은 CSV `text/csv`, JSON `application/json`. 확장자와 MIME을 함께 검증한다.
파일명은 영문·숫자·밑줄·하이픈과 `.csv`/`.json`만 허용하고 저장 경로로 사용하지 않는다.

공통 필수: `season`(현재 2026), `competition`(regular/postseason), `as_of`.
시각은 `YYYY-MM-DDTHH:mm:ss`를 KST로 해석한다. `+09:00` 또는 `Z`도 허용하며
존재하지 않는 일자/24시를 거부하고 UTC ISO로 정규화한다. 날짜는 `YYYY-MM-DD`이다.
모든 ID는 `demo_` 접두사가 있는 자체 ID다.

| 파일 | 공통 필드 외 필수 열 | 검증 |
| --- | --- | --- |
| players | external_player_id, player_id, display_name, role | 이름은 DEMO 접두사. BATTER/STARTER/RELIEVER |
| games | game_id, played_on, scheduled_at_kst, home_team_id, away_team_id, status | 홈/원정 상이. SCHEDULED/IN_PROGRESS/SUSPENDED/FINAL/CANCELLED/VOID |
| batting_game_logs | external_player_id, game_id, team_id, pa, ab, h, hr | 0~1000 정수, HR ≤ H ≤ AB ≤ PA |
| pitching_game_logs | external_player_id, game_id, team_id, role, innings, h, er, so | STARTER/RELIEVER. innings는 문자열 6.0/6.1/6.2, 6.2=20아웃. 6/6.3 거부 |
| rosters | external_player_id, team_id, snapshot_on, effective_on, status | REGISTERED/UNREGISTERED/UNKNOWN, 효력일 ≤ 스냅샷일 |

헤더 별칭: 외부선수ID→external_player_id, 선수ID→player_id, 선수명→display_name,
역할→role, 시즌→season, 대회→competition, 기준시각→as_of. 별칭 기능은 파서에 구현하되
현재 HTTP 업로드는 승인 샘플 checksum 제한을 유지한다.
동명이인은 이름으로 합치지 않고 서버의 source별 외부 ID 매핑을 사용한다.
DEMO 매핑/경기 참조는 승인 샘플에서 로드한다. 임의 외부 ID·알 수 없는 경기는 오류다.

## 검증 리포트와 보안

`importBatchId`, 원본 bytes `checksum`(SHA-256), `sourceId`, `licenseId`, `schemaVersion`,
`importedAt`, mode, 상태, 입력 행수, 수용 행수(sampleSize), 신규/업데이트/중복/오류/경고를 기록한다.
수용된 행의 season/competition/as_of와 이닝→아웃 변환을 비공개 문서에 보존한다.
오류/경고 수는 이슈 수이며 한 행에 둘 이상일 수 있다. UI 이슈는 최대 200건이고 잘림 여부를 기록한다.
행 번호는 CSV 헤더를 제외한 데이터 순번이다. 원본 문자열·Zod 입력값은 오류 응답에 넣지 않는다.
PA>10, 아웃>36, H/ER/SO>30은 검토 경고다. 이는 DEMO 보조 기준이며 공식 규칙이 아니다.

신규/업데이트/중복은 주입된 기존 정규화 레코드와 키/값으로 비교한다. HTTP 샘플 모드는
public baseline이 없으므로 기존 레코드는 비어 있다. 이전 dry-run은 게시 데이터가 아니므로
재업로드도 신규로 보고한다. 동일 파일 내 같은 행은 중복, 같은 키의 다른 값은 오류다.

수식으로 해석될 수 있는 `= + - @` 시작 셀은 선행 공백/제어문자를 포함해 거부한다.
CSV 다운로드는 자체 고정 샘플만 제공하므로 사용자 입력이 export되지 않는다.
권한 검증은 body 읽기 전 수행한다. Content-Length가 없어도 스트림 누적 바이트를 제한한다.
일반 로그에 원본·토큰·개인정보를 출력하는 코드는 없다. staging은 0700 디렉터리/0600 파일,
서버 생성 UUID와 배타 생성으로 저장하며 public 정적 파일 경로 밖에 둔다.

## 검증 및 다음 단계

- `pnpm test`: parser/row validator/HTTP/비공개 파일 저장 테스트.
- `node scripts/ingest-e2e.mjs`: 임시 난수 관리자 토큰을
  테스트 프로세스에서 발급해 무권한 차단·업로드→리포트·모바일/axe를 확인한다.
- `pnpm lint`, `pnpm typecheck`. Prisma 미설치로 전체 타입 검사에 기존 장애가 있다.

현재 staging은 단일 서버 로컬 파일이다. DB ImportBatch/ImportRowIssue 스키마를 변경하지 않으며
원본 파일 전체를 보관하지 않는다. 운영 영속 저장, 권리 registry, 감사 주체/토큰 회수,
보관 기간·쿼터·다중 인스턴스 및 원자 게시/롤백은 다음 단계다.
실제 데이터 활성화에는 별도 권리 승인과 서버 registry 및 정식 관리자 계정 통합이 필요하다.

## 이번 실행 결과

- `pnpm test`: 5개 파일, 37개 테스트 통과. 정상 CSV/JSON, 누락, 동명이인, 중복/정정,
  이상치, 불완전 이닝, UTF-8/BOM/인코딩 오류, 크기 초과, 무권한·다른 출처 차단 포함.
- `node scripts/ingest-e2e.mjs` (`pnpm test:ingest:e2e`): Chromium 2개 통과.
  관리자 업로드→리포트→미공개 상태 및 무권한/모바일/axe 확인.
- `pnpm lint`: 통과. 전용 브라우저 테스트 빌드 디렉터리는 lint 대상에서 제외한다.
- `pnpm typecheck`: 실패. 기존 `prisma.config.ts`의 `prisma/config` 패키지가 설치되지 않았다.
- `pnpm build`: 애플리케이션 컴파일 성공 후 같은 Prisma 타입 오류로 실패.
  전체 타입 검사/프로덕션 빌드 통과를 주장하지 않는다. 패키지는 추가 설치하지 않았다.
- 브라우저 테스트는 샌드박스 포트 제한 해제 후 실행했다. 기존 3000번 개발 서버는
  종료하지 않았으며 3101번/`.next-ingest-e2e` 출력 디렉터리로 분리했다.

## 관리자 승인 게시 및 정정 재현

이 절은 이전의 “게시 불가” 설명을 **자체 제작 DEMO 샘플** 범위에서 대체한다.
관리자 SHA-256 capability 설정은 기존 방식 그대로이며 토큰·원문 비밀은 저장/커밋하지 않는다.

1. `/admin`에서 players → games → rosters → batting_game_logs 순서로 JSON 샘플을 내려받고 업로드한다.
2. 각 배치 검증 후 토큰을 다시 입력하고 **이 배치 공개 게시 승인**을 누른다.
   업로드 자체로는 공개되지 않는다. publish 요청은 인증과 `{batchId, approve:true}`가 모두 필요하다.
3. `/published`에서 안타 2, 표본 1경기를 확인한다. 동일 출전 샘플을 두 번 더 업로드·승인해도 공개 행 수는 같다.
4. 타자 출전 종류의 **안타 정정** 샘플을 업로드·승인한다. 공개 행 수는 그대로이고 안타는 3이 된다.
5. `/api/v1/published?season=2026&competition=postseason`은 정규시즌 데이터를 포함하지 않는다.

API: `POST /api/admin/ingest/publish`, `GET /api/v1/published`.
검증 실패는 422 및 행 번호/코드/필드/설명으로 반환한다. 기존 공개 행에서 발생한 참조 오류는
행 번호 0과 메시지의 논리 키로 표시한다. 한 오류라도 배치 전체 중단이며 일부 행만 게시하지 않는다.
경고는 관리자 검토 대상으로 남기고 명시적 승인 시 게시할 수 있다.
최초 검증과 publish 시 재검증 이력은 비공개 state에 보존한다. 공개 결과에는 raw/감사/관리자 정보를 노출하지 않는다.
공개 행에는 출처/licenseId/batchId/as_of/시즌/대회, 집계에는 표본 크기/inputRefs를 유지한다.
공개마다 승인 licenseId와 displayAllowed 및 transformAllowed를 모두 확인한다.

검증: `pnpm test`, `node scripts/ingest-e2e.mjs`.
Playwright는 별도 `.demo/pipeline-e2e`를 사용하며 게시 테스트는 해당 저장소를 초기화/정리한다.
실제 운영 저장소나 기존 fixture.sqlite를 초기화하지 않는다.

## 관리자 운영

.env.example에 명시된 ADMIN_ORIGIN, ADMIN_ACTOR_ID, ADMIN_SESSION_SECRET(무작위 64자 이상), INGEST_ADMIN_TOKEN_SHA256(별도 무작위 32~256자 토큰의 SHA-256)을 비밀 관리 시스템에서 주입한다. 저장소에는 값을 제공하지 않는다. 내부 HTTPS 주소의 /admin/login에서 로그인한다. 공개 주소는 관리자 경로를 ingress에서 거부해야 한다. 로컬 개발은 127.0.0.1의 Secure 쿠키 지원 브라우저를 사용한다.

템플릿 다운로드·업로드/dry-run·상태(/api/admin/ingest/status)·게시·되돌리기 모두 ADMIN만 가능하다. 게시에는 approve:true와 checklist의 collect/store/display/transform/export 모두 true가 필요하다. 체크리스트만으로 실데이터 권리가 생기지 않는다: 서버는 자체 제작 DEMO fixture checksum만 허용하며 실데이터 import 및 삭제 API는 제공하지 않는다. db:seed/db:reset도 .demo/fixture.sqlite만 대상으로 한다. 출처·계약 상태가 APPROVED가 아니면 게시가 거부된다. 실데이터용 별도 gate는 유효기간·범위·권리를 재검증한다.

되돌리기는 /api/admin/ingest/rollback에 batchId와 confirmation:"ROLLBACK DEMO"를 보내며 최신 게시에만 적용한다. 화면은 확인 대화상자를 제공한다. 향후 운영 실데이터 삭제 도입 시 대상 환경·namespace·예상 행 수를 묶은 일회성 확인 토큰과 별도 재인증을 먼저 구현해야 한다. 현재는 해당 작업을 차단한다.

확인: /admin/login → 로그인 → 템플릿 다운로드 → 업로드 → 파일 행 수/오류/출처/계약 확인 → 5개 권리 확인 → 게시 → 최신 게시 되돌리기. 세션 만료 시 다시 로그인한다. 별도 로그아웃 버튼으로 세션 쿠키를 제거한다.

## 검증 결과 (2026-11-03)

- `pnpm exec vitest run --maxWorkers=1 --testTimeout=15000`: 20개 파일, 212개 테스트 통과. 기본 5초 한도로는 momentum-snapshots의 한 테스트가 시간 초과하여 실패했다.
- `pnpm test:ingest:e2e`: Chromium 3개 통과. PUBLIC 접근 거부, 관리자 세션 로그인/미공개 dry-run, 명시 승인 게시 및 정정 집계를 확인했다. 첫 실행의 포트 sandbox 제한 후 로컬 서버 실행 권한으로 재시도했다.
- `pnpm typecheck`: 실패. 기존 prisma.config.ts가 참조하는 prisma/config 패키지가 설치되어 있지 않다. 패키지 추가 금지에 따라 설치하지 않았다.
- 배포 네트워크 ACL, IdP/MFA, 원격 불변 로그는 실제 연동·검증하지 않았다.
