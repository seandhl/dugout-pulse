# 선수 비교 검증 (2026-11-03)

## 수행 작업과 변경 파일

- `src/server/reads/compare.ts`: 공통 query 검증, 역할별 기존 계산기 연결, 결측/단위/시점/범위 비교 모델.
- `src/app/(public)/compare/page.tsx`: 검색과 두 슬롯 선택/교체/해제, URL 복원, 시즌·대회·기간·역할 폼, 표본과 숫자/막대, 원천 추적, 역할 불일치 경고.
- 같은 경로 `loading.tsx`, `error.tsx`: 로딩 및 실패 재시도. 오프라인 알림은 기존 shell 사용.
- `src/app/globals.css`: 모바일 단일 열과 비교 막대.
- `tests/unit/compare.test.ts`, `tests/e2e/compare.spec.ts`: 계산 단위/범위/역할/빈 기록, 선택/검색/교체/기간/링크 복원/뒤로가기/모바일 접근성 검증.
- `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`: ADR-023과 DEMO 경계 기록.

## 검증

- `pnpm test -- tests/unit/compare.test.ts`: 스크립트 인자 전달로 전체 단위 테스트 실행, 18파일 205개 통과.
- `pnpm exec vitest run tests/unit/compare.test.ts`: 최종 read 변경 후 비교 단위 테스트 2개 통과.
- `pnpm lint`: 통과.
- `pnpm exec prettier --check src/server/reads/compare.ts 'src/app/(public)/compare' tests/unit/compare.test.ts tests/e2e/compare.spec.ts src/app/globals.css`: 통과.
- `pnpm typecheck`: 실패. 기존 `prisma.config.ts:1`의 `prisma/config` 모듈 누락. 패키지 설치 금지에 따라 설치하지 않음.
- 최초 E2E는 샌드박스 포트 EPERM으로 시작 실패. 권한 확장 후 이미 실행 중인 3100 서버를 사용.
- 최초 `pnpm test:e2e -- ...`는 전체 E2E를 실행하여 기존 API 상세 테스트 실패와 여러 중단이 발생했다. 전체 E2E 통과를 주장하지 않는다. 비교 테스트는 선택자 문제 수정 후 별도 정확한 명령으로 재검증한다.
- 최종 비교 전용 E2E: 2개 통과 (11.5초). 역할 변경·시즌 전환·모바일 axe 검사 포함.
- 비교 전용 명령: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/compare.spec.ts --workers=1`.

## 화면 확인

`pnpm db:seed` 후 `pnpm dev --port 3100`, `/compare`에서 선수명/ID/팀을 검색해 두 슬롯에 선택한다. 기간/역할 변경 후 적용, 새로고침, 뒤로가기 및 주소 복사로 복원한다. `/compare?players=demo_0_10,demo_0_11&window=5`는 선발 비교, `players=demo_0_00,demo_0_14`는 혼합 역할 분리 표시다.

## 알려진 제한과 다음 단계 준비

DEMO 단일 2026 정규시즌만 존재한다. 미지원 시즌/포스트시즌은 비교 제외한다. 공통 기간은 5/10출전 또는 시즌이며 달력 기간이 아니다. 일부 fixture 지표는 결측이다. 시점 불일치 경고 분기는 있으나 단일 canonical release에는 실제 서로 다른 시점 자료가 없다. 실제 데이터 adapter와 선수별 시점 검증은 공급 계약 이후 진행한다. 전체 타입 검사 복구에는 기존 Prisma 의존성 정리가 필요하다.
