# 재현 가능한 검증

Node 26.11.0, pnpm 12.10.1 및 lockfile을 기준으로 한다. 외부 선수 데이터·계정·비밀은 사용하지 않는다. CI의 PostgreSQL 자격증명은 일회용 테스트 서비스 전용 공개 값이다. 패키지 추가는 없다.

설치된 의존성, Chromium, `psql`, 일회용 PostgreSQL을 준비한 뒤:

```sh
TEST_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:5432/fixture pnpm verify
```

CI는 frozen-lockfile 설치 → lint → 전체 typecheck → unit/integration 및 커버리지 → 실제 PostgreSQL migration 적용 → production build → production public E2E → 별도 admin E2E 순서다. 로컬 명령은 설치를 수행하지 않는다. 포트가 사용 중이면 `PLAYWRIGHT_PORT=3199`를 함께 지정한다. CI는 브라우저 worker 1개로 실행해 실제 공개 API rate limit을 유지한다. `.demo`의 DEMO DB를 seed하며 실제 운영 DB에는 연결하지 않는다. 관리자 E2E 인증은 실행마다 무작위 생성한다.

마이그레이션은 `TEST_DATABASE_URL`만 사용하고 고유 스키마를 생성해 SQL을 순서대로 적용한 뒤 ranking index 존재를 확인하고 스키마를 삭제한다. 운영 URL을 지정하지 않는다. Prisma CLI는 현재 의존성에 없으므로 Prisma schema와 SQL의 drift 검사는 포함하지 않는다.

| 필수 영역 | 재현 테스트 |
| --- | --- |
| data rights, import/publish 차단 | provider, admin-security, security-review, ingest, pipeline |
| CSV/JSON, 중복, 정정 전파 | ingest, pipeline, momentum-snapshots, scope |
| 타격/투구 계산, 5.2 IP, null | batting, pitching, fixture |
| 역할 기준선, 버전, 표본 부족, 회귀 fixture | momentum, momentum-golden, momentum-validation, momentum-snapshots |
| 날짜별 1군 엔트리, 시즌/대회 경계, freshness | scope, player-directory, player-detail, pitcher-detail |
| 검색/필터/상세/순위/비교/URL | 대응 unit 파일 및 e2e players, player-detail, pitcher-detail, rankings, compare |
| RBAC, DEMO, provenance | admin-security, security-review, provider, api 및 e2e ingest, api |
| 모바일, 키보드, 접근성 | e2e ux-qa, shell, ingest (320~1440px, axe, dialog focus 복귀) |
| API 오류/timeout/빈 값/부분 응답 | unit api 및 e2e api, ux-qa |

## 커버리지 계약

`pnpm test:core`는 Node inspector의 V8 precise coverage를 사용한다. batting/pitching/momentum 및 gate/admin 각 파일의 **이름 있는 함수 실행률**을 85% 이상으로 강제한다. 모듈 평가와 익명 함수는 제외한다. line/statement/branch coverage를 의미하지 않으며, 조건 분기 검증은 명시적 권한·계산 회귀 테스트로 보완한다. 추가 provider 설치 없이 실행한다. 함수 범위별 OR 병합으로 여러 격리 테스트의 실행을 합치고 대상 누락 또는 0 함수는 실패한다.

실측 (2026-11-03): 단위/통합 24 파일, 232 통과, 1 skip (선택적 performance benchmark). batting 8/8=100%, pitching 8/8=100%, momentum 27/27=100%, gate 5/5=100%, admin 8/8=100%. 상세 결과와 미실행 함수는 `coverage/core-summary.json`에 매 실행 기록한다. 이 수치는 전체 앱 커버리지가 아니다.

## 실패 확인

`pnpm verify`는 실패한 단계명을 출력하고 즉시 종료한다. Vitest는 파일/테스트명/위치를 출력한다. Playwright는 실패 시 trace와 screenshot을 보존하며 HTML report를 생성한다. CI artifact `verification-results`에서 다운로드한다. 로컬은 `pnpm exec playwright show-report`로 확인한다. responsive 캡처는 `test-results`에 저장하여 기존 QA 이미지를 덮어쓰지 않는다.

이번 실행의 환경 제한: 로컬에는 PostgreSQL 서버/psql/Docker가 없어 migration 실행을 검증하지 못했다. 실제 CI 실행 결과는 아직 없다. 이를 성공으로 간주하지 않는다.

## 최종 실행 결과 (2026-11-03)

- `pnpm lint`, `pnpm typecheck`, `pnpm build`: 통과.
- `pnpm test:core`: 232 통과, 선택적 성능 벤치마크 1 skip. 대상 5개 파일의 named-function coverage 각 100%.
- `PLAYWRIGHT_PORT=3199 VERIFY_PRODUCTION=1 CI=1 pnpm test:e2e`: 32/32 통과 (production, Chromium, 320~1440px).
- `CI=1 pnpm test:ingest:e2e`: 3/3 통과 (별도 dev server, 일회용 인증).
- `pnpm verify`: lint/typecheck/unit+coverage까지 통과한 뒤 `TEST_DATABASE_URL` 미설정으로 migration validation 단계에서 exit 1. 이후 단계는 개별 명령으로 검증했다. 전체 명령 성공으로 보고하지 않는다.
- 실제 SQL 적용 및 원격 CI 실행 결과는 미확인. 완료 수락은 일회용 PostgreSQL에서 전체 `pnpm verify` 또는 CI 성공 후 가능하다.

기계 판독 가능한 실행 기록: `reports/test-validation.json`. Next의 streaming not-found는 HTTP 200과 noindex/404 UI를 사용하므로 API의 404와 구분해 검증한다. 비교 링크 선택 후 새 화면이 반영된 것을 확인한 뒤 기간을 제출하여 이전 폼을 사용하는 경합을 방지한다.

## Verify URL 회귀 수정 (2026-11-03)

실패 증빙: https://github.com/seandhl/dugout-pulse/actions/runs/41642216977 (commit `1ae00bd939e83de14b5ca98eda76473ce6ec30fb`, job `125938323740`). 로그상 lint/typecheck, 235개 단위·통합 테스트, 2개 PostgreSQL migration, production build는 통과했다. public E2E 32개는 `apiRequestContext.get: Invalid URL` 또는 `page.goto: Cannot navigate to invalid URL`로 실패했고 admin 단계는 실행되지 않았다. PostgreSQL healthy 및 Chromium/SQL client 설치 성공도 확인했다.

원인: `verify.mjs`가 `PLAYWRIGHT_BASE_URL=""`를 주입했고 config의 `??`는 빈 문자열을 fallback하지 않았다. webServer 조건은 빈 값을 false로 처리하므로 로컬 서버를 실행하면서 요청 baseURL만 비는 불일치가 생겼다. DB·브라우저 설치 실패라는 추정은 해당 로그와 맞지 않는다.

수정: 전체 verify는 상속된 `PLAYWRIGHT_BASE_URL` 키를 제거하여 항상 자체 로컬 서버를 검증한다. 단독 E2E config는 trim 후 비어 있는 값을 미설정으로 처리하며, 같은 값으로 baseURL과 서버 소유 여부를 결정한다. 명시적 URL을 지정한 단독 E2E는 기존 외부 대상 동작을 보존한다. `tests/unit/verify-config.test.ts`는 미설정/빈 값/공백/명시 URL, production 서버와 요청 URL 일치, 전체 게이트 순서, 실패 즉시 중단 및 외부 URL 제거를 검증한다. orchestration 테스트의 자식 명령만 stub이며 실제 앱 검증을 대체하지 않는다.

서비스 수명은 기존 Playwright webServer에 맡긴다: seed 성공 후 start, HTTP 준비 확인 후 테스트, 기존 서버 재사용 금지, 종료 시 정리. admin은 별도 포트와 별도 build 디렉터리/dev 서버 및 실행별 임시 인증을 유지한다. workflow의 PostgreSQL 서비스 healthcheck, TEST_DATABASE_URL, Chromium 설치, 실패 artifact 업로드는 유지한다. SQL은 일회용 DB 내 고유 스키마만 생성/정리한다. 데이터 계약·modelVersion·provenance·DEMO/REAL 분리 및 공개 API는 변경하지 않는다.

로컬 전체 `pnpm verify`는 lint/typecheck 및 241 테스트 통과(기존 선택 성능 테스트 1 skip), 대상 5파일 coverage 100% 후 TEST_DATABASE_URL 부재로 migration에서 exit 1이다. psql/PostgreSQL/Docker가 없으므로 로컬 SQL 검증은 미실행이며 이를 전체 성공으로 간주하지 않는다. 별도 E2E/빌드와 수정 후 원격 CI 결과는 후속 실행 기록에 남긴다.
