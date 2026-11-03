# API 계층 검증 — 2026-11-03

## 수행·변경

- 공개 경로를 `src/app/(public)`로 이동 (URL 유지).
- `src/contracts/api.ts`: query/params/DTO/공통 응답/오류 Zod 계약.
- `src/server/{ports,reads,repositories,http,db}` 및 composition: 저장소 주입, fixture 조회, 서명 커서, 응답 검증, 서버 전용 경계.
- `/api/v1/meta`, `/api/v1/players`, `/api/v1/players/:id`: 실제 호출 가능한 DEMO API.
- `fixtures/players-v1.json`, README: 제작 이력/해시/시각/표본 0.
- `src/components/features/api-preview.tsx`: 네트워크 오류/타임아웃/재시도/로딩/빈 결과.
- `tests/unit/api.test.ts`, `tests/e2e/api.spec.ts`, Vitest 설정: 서비스/HTTP/브라우저 검증.
- API_CONTRACT, DECISIONS, ASSUMPTIONS: 실행 범위와 미완료 DB 경계 명시.

## 검사 결과

- `pnpm test`: 2 파일, 6 테스트 통과. 입력 검증·커서 서명/필터 바인딩·오류 비노출·singleton 수명 포함.
- `pnpm lint`: 통과.
- `pnpm exec prettier --check src/contracts src/server src/components/features src/app/api tests/unit/api.test.ts tests/e2e/api.spec.ts`: 통과.
- `pnpm exec playwright test --config playwright.preview.config.ts tests/e2e/api.spec.ts`: 기존 3000 서버에서 2 테스트 통과. HTTP 200/400/404 및 네트워크 차단 후 재시도 성공.
- 기본 Playwright 실행은 sandbox 포트 권한으로 실패. 허용 후 3100 시도는 기존 dev 서버 lock으로 실패. 기존 서버를 종료하지 않고 preview 설정으로 검증했다.
- `pnpm typecheck`: 실패. 기존 prisma.config.ts가 설치되지 않은 prisma/config를 참조함. 이동 전 .next/dev/types/app 캐시는 제거 후 타입 재생성, 남은 오류는 prisma/config 한 건.
- `pnpm build`: webpack 컴파일 성공, 타입 검사 실패. 빌드 성공으로 보고하지 않는다.
- DB 통합/Prisma generate/smoke 미실행: Prisma/adapter/pg 패키지 및 생성 client 부재, 설치 금지 조건 유지.

## 화면 확인

`pnpm dev` 실행 후 `/players`에서 DEMO API 불러오기. 개발자 도구에서 offline 전환 후 다시 요청하면 오류 안내, online 복구 후 다시 시도하면 가상 선수 목록. `/api/v1/meta`, `/api/v1/players?limit=1`, `/api/v1/players/demo_a` 직접 확인 가능.

## 제한·다음 단계

실데이터 연동 없음. DB repository 파일은 공개 projector 검증 경계이며 실제 Prisma 쿼리 구현이 아니다. DB singleton은 주입 factory에 대한 수명 관리이며 생성 Prisma 인스턴스 및 shutdown hook은 아직 연결하지 않았다. 현재 DEMO만 허용한다. 세부 stats/랭킹/비교/게시/권리/인증/rate limit/staleness 정책은 구현되지 않았다. API_CONTRACT의 전체 설계와 이번 축소된 실행 계약을 구분한다.

다음 단계는 설치가 허용된 범위에서 고정 Prisma/adapter/pg 의존성 및 생성 client를 준비하고, 게시/권리 조회 트랜잭션을 가진 실제 DB projector와 종료 hook을 구현하여 실제 PostgreSQL 계약 테스트를 수행하는 것이다. 따라서 전체 DB 포함 단계 완료를 선언하지 않는다.
