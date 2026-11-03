# 선수 탐색 검증 · 2026-11-03

## 수행 작업과 변경 파일

- `src/app/(public)/players/page.tsx`, `src/components/features/player-directory.tsx`, `src/app/globals.css`: 한국어 검색/350ms 디바운스/IME, URL 조건 복원, 필터, 키보드, 오류·빈 결과·오프라인 안내·재시도, 아바타 대체, 출처/시점/신뢰도.
- `src/contracts/player-directory.ts`, `src/server/reads/player-directory.ts`, `src/app/api/v1/player-directory/route.ts`: 별도 검증 계약, 서버 필터/정렬/20명 페이지, 소속 이력과 null 처리. 기존 v1 players 계약과 DB 스키마는 유지.
- `tests/unit/player-directory.test.ts`, `tests/e2e/players.spec.ts`: 단위/브라우저 검증.
- `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`: 채택 기본값과 공급 데이터 미확인 범위.

## 명령과 결과

- `pnpm db:seed`: 성공, 외부 수집 없음.
- `pnpm test`: 14개 파일, 193개 테스트 통과. 150명 원본 fixture에서 출장자 138명의 전체 페이지 중복/누락 검사, 한국어 NFC/동명이인, 역할/팀/기간/정렬/빈 상태 검증 포함.
- `pnpm lint`: 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/players.spec.ts`: 모바일/데스크톱 및 오류 후 재시도 3개 통과. axe 위반 0, 가로 넘침 없음. URL 재로드 및 키보드 이동 확인.
- `pnpm typecheck`: 실패. `prisma.config.ts`의 `prisma/config` 모듈을 찾을 수 없음. 패키지 설치 금지에 따라 의존성을 추가하지 않음. 전체 빌드 통과를 주장하지 않음.
- 최초 단위 검사는 미출장자까지 150명으로 예상해 실패했으며, 시즌 출장 계약에 맞춰 원본 150명/출장자 전체 페이지 검증으로 수정 후 통과.
- 최초 브라우저 검사는 초기 컴파일 대기 시간/선택자 문제로 실패했고 대기 시간과 레이블을 수정 후 통과.

## 화면 확인

`pnpm db:seed`, `pnpm dev --port 3100` 후 `/players?role=starter&sort=era&window=5&team=sample_0`에서 3명 결과 확인. URL을 새 창에 붙여 조건 재현. `test-results/players-390.png`, `players-1440.png`는 브라우저 캡처이며 모바일 화면을 직접 확인함.

## 알려진 제한과 다음 단계 준비

실제 선수/공식 데이터 연동 없음. 현재 1군·주 포지션·등번호 이력·이전 점수는 미제공이며 관련 컨트롤은 비활성화 또는 설명한다. OPS 필수 원천 항목 부족은 null이며 ERA와 기세만 유효 표본에서 산출한다. 기세 점수는 역할별 모델이므로 역할 선택 후 비교한다. 시즌은 2026 정규시즌만 지원하며 초성 검색은 미구현이다. 자동 axe와 키보드 검증은 실제 스크린리더 청취 시험을 대체하지 않는다.

다음 단계는 승인된 공급 계약과 등록/포지션/등번호 유효기간/기록 필드/이전 스냅샷 확보 및 기존 Prisma 의존성 복구 후 전체 타입·빌드 검증이다.

## 선수 탐색 유지보수 · 2026-11-04

### 변경 범위와 설계

기준 브랜치 `codex/b01-visual-system`, 커밋 `6f72cd03620f4ca8278b8c0673437d30f9deac8c`의 미커밋 작업을 보존하고 `codex/player-directory-navigation`을 생성했다. 실제 Git 루트는 이 프로젝트다(AGENTS의 홈 루트 설명과 현재 상태가 다름). 커밋·푸시·배포·패키지 설치·외부 수집은 하지 않았다.

- `src/components/features/player-directory.tsx`: URL 변경마다 전체 재마운트하던 구조를 제거해 검색 포커스를 유지. 350ms debounce/IME, URL 변경 시 대기 검색 취소, 필터 변경 시 대기 중 이름 동시 반영, 초기화 시 대기 검색 취소. 이름·소속·역할 / 최근 경기·표본·정렬 fieldset과 활성 칩, 공유 URL 복사 대화상자, 직접 페이지 선택, 페이지 변경 후 결과 포커스, 범위 초과 페이지 URL 보정, 상세 왕복 선택 링크·스크롤 복원.
- `src/contracts/player-directory.ts`, `src/server/reads/player-directory.ts`: 선택 sample 필터를 페이지 분할 전에 적용. 기존 기본 결과·고정 동점 정렬·전체 기세·출처·등록 unknown 보존.
- `src/app/globals.css`: 모바일 필터 그룹의 최소 폭·간격·테두리.
- `tests/unit/player-directory.test.ts`, `tests/e2e/players.spec.ts`: 표본 분할·페이지 중복 방지 및 모바일/키보드/IME/지연/오래된 응답/오류/오프라인/뒤로가기/URL/페이지/정렬 회귀.
- `docs/DECISIONS.md` ADR-034, `docs/API_CONTRACT.md`, `docs/ASSUMPTIONS.md`, 이 문서: 선택 쿼리 계약·이행·수락 범위와 실행 기록. DB 스키마/저장 데이터 이행은 불필요하다.

출전 없음(결과 0), 선택 경기 수 미달, OPS 필수 항목 누락, 투구 아웃 표본 없음, 유효 기세 스냅샷 없음은 다른 문구로 구분한다. 미달은 모델 부적격을 의미하지 않는다. 등록 스냅샷이 없어 현재 1군 등록은 지원하지 않으며 시즌 출전으로 추정하지 않는다.

### 실행 기록

- `pnpm test -- tests/unit/player-directory.test.ts`: 실제 runner가 전체 28파일을 실행해 268 통과, 기존 선택 성능 테스트 1 skip. 성공한 실행 범위를 명령 의도와 구분한다.
- `pnpm exec vitest run tests/unit/player-directory.test.ts`: 관련 11/11 통과.
- 최초 E2E: sandbox의 loopback listen EPERM으로 서버 시작 실패. 로컬 서버/Chromium 실행 권한으로 재시도했다.
- 첫 개발 E2E: 6 통과/2 실패. 두 실패는 `getByLabel(... exact)`가 표본 select를 찾지 못한 타임아웃이다. 접근 가능한 role/name 선택자로 수정했다.
- `CI=1 PLAYWRIGHT_PORT=3197 VERIFY_PRODUCTION=1 pnpm exec playwright test tests/e2e/players.spec.ts --workers=1`: 중간 production 버전 9/9 통과.
- `CI=1 PLAYWRIGHT_PORT=3197 pnpm exec playwright test tests/e2e/players.spec.ts --workers=1`: 페이지 직접 이동/공유/정렬/URL 보정까지 추가한 최종 개발 버전 10/10 통과. 390/1440px axe 위반 0 및 가로 넘침 없음. 390px 전체 캡처를 직접 확인했다.
- 최종 `pnpm typecheck`, `pnpm lint`: exit 0.

### 화면 확인과 수락 범위

`pnpm dev --port 3100` 후 `/players`에서 이름 입력 → 링크 선택으로 상세에 도달한다. E2E는 가상 A-01에 대해 2조작 경로, 상세에서 뒤로가기 후 링크 포커스, 새로고침 후 검색·결과 일치, 칩 제거, 표본 URL/뒤로가기를 확인한다. `/players?role=starter&sort=era&window=5&team=sample_0`으로 공유 조건을 재현한다. `/players?page=99999&sort=games`는 실제 마지막 페이지로 URL이 보정되며 직접 페이지 선택으로 이동할 수 있다. `pnpm exec playwright show-report`로 브라우저 결과를 확인한다.

선수명을 아는 탐색 경로에 대한 수락 증거이며 모든 모호한 탐색 의도에 대한 3조작 보장은 아니다. 실제 스크린리더 청취·실기기·다른 브라우저 검증, 전체 앱 E2E/DB migration/원격 CI는 이번 변경에서 미실행이다. 기세 null의 상세 모델 제외 사유는 기존 목록 계약에 없어 추정하지 않는다. 세션 저장소 차단 시 링크·스크롤의 추가 복원은 제공되지 않고 브라우저 기본 동작을 따른다. DEMO 2026 정규시즌만 지원하며 실제 기록/등록 권한은 없다.

### 되돌리기와 다음 단계

작업 전부터 같은 파일에 미커밋 변경이 있었으므로 `git restore`나 전체 파일 교체로 되돌리지 않는다. 이번 변경의 fieldset/칩·URL/복원 처리, sample 쿼리/서버 조건, 추가 CSS 블록, 추가 테스트와 ADR-034 문서 블록만 선택적으로 역적용하고 단위/E2E를 재실행한다. 커밋과 DB 변경이 없어 revert 커밋 또는 DB rollback 대상은 없다.

다음 단계 진입 조건은 이 feature 브랜치의 기존 미커밋 작업과 이번 diff를 함께 리뷰하고, 변경 범위에 동의한 뒤 별도 커밋/병합을 결정하는 것이다. 실제 데이터 도입은 공급·권리·등록 스냅샷 계약 승인 후 별도 단계에서 진행한다.

최종 빌드 이후 추가 확인: `pnpm build` exit 0. `CI=1 PLAYWRIGHT_PORT=3197 VERIFY_PRODUCTION=1 pnpm exec playwright test tests/e2e/players.spec.ts --workers=1`은 최종 production 빌드에서 **10/10 통과 (25.9s)**. 선택 변경 파일의 `git diff --check`도 exit 0이다. Git diff 통계에는 작업 전부터 있던 변경이 함께 포함되므로 이번 작업 단독 통계로 사용하지 않는다.
