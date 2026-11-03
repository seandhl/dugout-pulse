# R16 비교 선택기 검증 (2026-11-04)

## 수행 작업·변경 파일

작업 시작 브랜치 `codex/player-directory-navigation`, 커밋 `6f72cd0`. 실제 Git 루트는 프로젝트 자체다. 기존 미커밋 변경을 보존하고 `codex/r16-compare-picker`에서 작업했다. 커밋·푸시·배포·설치·외부 데이터 수집은 수행하지 않았다.

- `src/app/(public)/compare/page.tsx`: 두 슬롯과 선택기 분리, 찾기/교체 앵커, 해제/자리 교환 URL, 주요 지표와 방향·표본의 한국어 표시.
- `src/components/features/compare-picker.tsx`: 즉시 이름/ID/팀/역할 검색, 15명 단위 이전/다음 페이지, 선택 상태, 결과 수 알림과 페이지 이동 초점.
- `src/app/globals.css`: 선택 후보와 주요 기록 강조. 기존 모바일 세로/데스크톱 두 열 유지.
- `src/server/reads/compare.ts`: asOf 불일치 직접 수치 비교 차단.
- `tests/unit/compare-asof.test.ts`: 기존 DEMO 계산을 유지하고 detail 시점만 mock하여 불일치 차단 검증.
- `tests/e2e/compare.spec.ts`: 375px 후보 제한, 팀/역할/이름 즉시 검색, 키보드 선택, 선택 표시, 교체/해제/자리 교환, 역할 교환, URL 복원, 중복/3인 조작, 모바일/데스크톱 배치와 axe.
- `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`, 이 문서: 결정과 검증 경계.

## 설계 결정

ADR-035 채택. query/API/저장 스키마/modelVersion/provenance/DEMO·REAL 경계는 보존한다. 데이터 마이그레이션은 없다. 클라이언트에는 후보 요약과 선택 URL을 전달하며 수치 계산은 기존 서버 경계에 둔다. 후보 DOM은 최대 15명이고 다음 페이지는 기존 후보를 교체한다. 조건 폼과 분리된 검색 입력은 HTML form 속성으로 연결해 Enter/조건 적용 시 현재 검색어가 유지된다.

## 검증 이력

- 최초 E2E는 sandbox loopback bind `EPERM`으로 서버 시작 실패. 권한 확장 후 재실행했다.
- 첫 브라우저 실행: 4 통과/1 실패. 검색 후 조건 적용이 이전 q로 복원되는 문제를 실제로 발견해 form 연결로 수정했다.
- 두 번째 실행: 5 통과/1 실패. 팀 후보를 15명으로 가정한 테스트가 실제 14명 fixture와 달랐다. 후보 기대값을 수정했다.
- 최종 결과는 아래 기록한다. 이전 실패를 성공으로 계산하지 않는다.

## 화면 확인 방법

`pnpm dev --port 3100` 후 `/compare`에서 이름·팀·타자/선발/불펜을 입력한다. 최초 최대 15명만 나오고 이전/다음으로 이동한다. Tab/Enter로 선수 선택, 슬롯의 찾기·교체/선택 해제, 자리 바꾸기를 확인한다. URL을 복사해 새 탭에서 열어 두 선수·기간·역할이 복원되는지 확인한다.

`/compare?players=demo_0_10,demo_0_11&window=5`에서 375px 세로 카드/1440px 가로 그리드, ERA·K/9 방향, 표본·출처·기준일을 확인한다. 혼합 역할은 `players=demo_0_00,demo_0_14`, 중복은 `players=demo_0_01,demo_0_01`이다. 로딩·오류 경계와 오프라인 안내는 기존 구현을 사용한다.

## 알려진 제한·다음 단계 진입 조건

- 단일 DEMO fixture가 모든 선수에게 동일 asOf를 부여하므로 불일치 상태를 실제 URL로 재현하는 E2E는 미실행이다. 격리 단위 회귀로 차단 정책을 검증했다. 이 요구까지 포함한 전체 완료로 간주하지 않는다. 복수 시점 입력 계약/fixture 경로를 승인하고 실제 브라우저 불일치 경고·막대 차단 E2E를 추가해야 한다.
- axe와 키보드 브라우저 테스트는 실제 VoiceOver/NVDA 청취 검증을 대신하지 않는다. 스크린리더 수동 검수는 미실행이다.
- 후보 요약 150개는 서버에서 전달하지만 DOM에는 15개만 렌더링한다. 현재 DEMO 규모의 로컬 검색이다. 실제 대규모 선수 검색 API로의 전환은 승인된 데이터 계약 후 결정한다.
- 검색 중 입력은 즉시 필터링하고 선택/Enter/조건 적용 시 URL에 저장한다. 후보 페이지 번호는 공유하지 않는다.

## 되돌리는 방법

기존 미커밋 변경이 있으므로 `git restore`로 파일 전체를 되돌리지 않는다. 이번 작업 전 파일은 `/tmp/dugout-r16-before`에 보존했다. R16만 담은 `/tmp/dugout-r16.patch`에 대해 프로젝트 루트에서 `git apply --reverse --check /tmp/dugout-r16.patch` 후 `git apply --reverse /tmp/dugout-r16.patch`를 실행한다. 후속 변경이 겹쳐 check가 실패하면 강제로 적용하지 않고 해당 hunk를 검토한다. 임시 파일은 OS 정리 시 사라질 수 있다.

## 최종 실행 결과

1. `pnpm exec vitest run tests/unit/compare.test.ts tests/unit/compare-asof.test.ts`: 2파일/5개 통과. 계산·역할·3인 검증과 시점 불일치 차단 포함.
2. `pnpm exec playwright test tests/e2e/compare.spec.ts --workers=1`: dev server에서 7/7 통과 (35.7초).
3. `pnpm typecheck`: exit 0, route typegen 및 전체 tsc 통과.
4. `pnpm lint`: exit 0, warning 0.
5. `pnpm build`: exit 0, production compile/TypeScript/static generation 통과.
6. 검색 입력 CSS 보완 후 `VERIFY_PRODUCTION=1 pnpm exec playwright test tests/e2e/compare.spec.ts --workers=1`: production에서 7/7 통과 (14.2초). 375px 최대 15명, 가로 넘침 없음, 키보드 선택·페이지 초점·axe·공유 URL·중복·3인 조작·역할 교환 포함.
7. 변경 코드 6파일의 `pnpm exec prettier --check ...`, 대상 `git diff --check`: 통과.

375px/1440px production PNG를 실제 열어 세로/가로 카드 및 검색 입력을 확인했다. 파일: `test-results/compare-R16-mobile-cards-a-71542--grid-retain-metric-context-chromium/r16-compare-375.png`, 같은 경로 `r16-compare-1440.png`. 후속 Playwright 실행은 이 출력 경로를 정리할 수 있다. 전체 앱 E2E/전체 단위 suite와 SQL 검증은 이번 변경 범위에서 미실행이며 비교 전용 검증을 전체 앱 통과로 표현하지 않는다.
