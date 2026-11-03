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
