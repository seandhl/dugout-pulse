# 선수 탐색 경험 — 2단계 검증 (2026-11-05)

## 수행 작업

기존 선수 상세에 기세 분석·시즌 기록 탭을 추가했다. 중복 페이지는 만들지 않았다. 상단에 기존 기본 아바타·이름·소속·역할·포지션 미제공·기세 점수와 기간/표본/신뢰도를 표시한다. 기존 최근 기간, 타격/투구 분석, 비교 링크, 원천 추적은 유지했다. 탭은 URL에 저장하며 새로고침과 기간/역할 변경에도 유지한다. 시즌 기록은 최근 선택 창과 별개인 시즌 전체 완료 경기 집계다.

- 타자: AVG/OBP/SLG/OPS, wRC+, G/PA/H/HR/RBI/SB 항목과 한국어 정의. 실제 공급값 없는 wRC+는 데이터 없음이며 평균 기준 100의 의미만 설명한다.
- 투수: ERA/WHIP/IP/SO/BB/G/GS/W/L/SV/HLD와 한국어 정의. 시즌은 선발·불펜 합산이며 기존 기세 분석에서는 역할별 표본/기록을 유지한다.
- 시즌 선택에는 실제 fixture의 2026 DEMO만 표시한다. 정규시즌과 포스트시즌을 섞지 않으며 미지원 season/competition/역할은 빈 상태다.
- 타격 비율 3자리, ERA/WHIP 2자리, 누적 정수, IP 소수부는 아웃 수로 표시한다. 표본·기준일·업데이트·출처와 시즌 전체 원천 참조를 제공한다.
- 게시 스냅샷 상세에도 두 탭을 적용했다. 해당 게시 기준의 시즌 일반 기록이 연결되어 있지 않으므로 시즌 탭은 데이터 없음으로 표시하고 현재 fixture 기록을 가져와 대신 채우지 않는다.
- 상세 요청에 15초 제한과 취소된 응답 방어를 추가했다. 기존 로딩·오류·재시도·잘못된 주소 처리를 사용한다.

## 변경 파일

- `src/components/features/detail-sections.tsx` (신규): URL 기반 상위 탭과 query 보존.
- `src/components/features/season-records.tsx` (신규): 역할별 시즌 기록·정의·누락/빈 상태·출처.
- `src/components/features/detail-shared.tsx`: 상단 점수/표본/신뢰도와 타격·투구 겸업 링크, 분석 선택 기간 표본 표기.
- `src/components/features/player-detail.tsx`, `pitcher-detail.tsx`: 기존 분석을 기세 탭에 배치, 시즌 탭 연결, query 보존과 요청 취소/시간 제한.
- `src/app/(public)/players/[id]/page.tsx`: 게시 스냅샷 탭, 미지원 시즌/대회/역할 상태, 기존 상세의 겸업 분기.
- `src/server/reads/player-detail.ts`, `pitcher-detail.ts`: 원시 타점/선발 등판 수와 시즌 원천 참조의 추가 호환 read DTO.
- `src/app/globals.css`: 반응형 시즌 지표 카드.
- `tests/unit/season-records.test.ts`, `tests/e2e/season-records.spec.ts` (신규): 집계/결측/원천/역할 분리 및 사용자 동작 검증.
- `docs/API_CONTRACT.md`, `DECISIONS.md`, `ASSUMPTIONS.md`, 이 문서: 호환 계약과 제약/검증 기록.

1단계의 미커밋 변경은 보존했다. 커밋·푸시·패키지 설치·사용자 서버 종료·DB 초기화/재시드·외부 수집은 하지 않았다. 기세 모델/fixture/저장 스키마 변경 없음. 추가 필드는 read DTO이므로 SQL 마이그레이션 해당 없음.

## 데이터 구분

실제 데이터 연결 없음. 기존 자체 제작 `synthetic_v2` DEMO 2026 정규시즌만 사용한다. 사진/주 포지션/현재 등록 상태 권한·자료 미확보이므로 기본 아바타와 미제공 표기 유지.

- 제공: 원시 기록 기반 AVG/SLG, G/PA/H/HR/RBI, ERA/WHIP/IP/SO/BB/G/GS. RBI는 원시 타점 합산, GS는 실제 선발 역할 출전 수이며 최근 창과 독립적이다.
- 미제공: wRC+ 및 리그/구장 보정 데이터, 승패, fixture의 SB/SV/HLD. HBP/SF 결측으로 OBP/OPS도 데이터 없음. 유효한 기록의 0과 누락 null을 구분한다.
- 빈 시즌: 값은 데이터 없음, 출전 기록 부재 안내. 원시 타점 한 항목이라도 결측이면 시즌 타점을 0으로 합산하지 않는다.
- 기존 listedRoles 구조는 타격/투구 및 선발/불펜을 구분할 수 있다. 현재 실제 fixture의 겸업은 선발/불펜이며 이 경로를 브라우저에서 검증했다. 타격·투구를 함께 하는 fixture를 새로 만들지는 않았다.

## 검사 결과

- `pnpm typecheck:app`: 통과.
- `pnpm lint`: 통과.
- `pnpm exec vitest run tests/unit/season-records.test.ts tests/unit/player-detail.test.ts tests/unit/pitcher-detail.test.ts tests/unit/api.test.ts`: 4파일, 10테스트 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/season-records.spec.ts tests/e2e/player-detail.spec.ts tests/e2e/player-identity.spec.ts --workers=1`: 10테스트 통과. 기존 상세/목록 회귀 포함.
- 시즌 E2E: 320/1440px 타격, 390px 겸업 투구, URL 탭 복원, 키보드 이동, API 값 일치, wRC+/누락값, 시즌 범위, 빈 시즌, 잘못된 탭/주소, 요청 실패/재시도. axe 위반 0, 가로 넘침 없음.
- 최종 역할 빈 상태 보완 후 `season-records.spec.ts`를 재실행하여 5개 모두 통과했다. 포맷 검사와 `git diff --check`도 통과했다.
- 첫 E2E는 앱 alert와 Next.js route announcer를 동시에 선택해 1개 실패했다. 테스트 선택자를 section으로 한정해 수정했고 위 최종 10개가 통과했다.
- `test-results/season-batting-320.png`, `season-batting-1440.png`, `season-pitching-390.png`: 화면 캡처. 모바일 지표 카드·빈 값·설명·출처를 육안 확인했다. 긴 요소 캡처에는 기존 고정 탐색 바가 겹쳐 찍힐 수 있다.
- 게시 스냅샷이 없는 현재 로컬 상태에서 게시 스냅샷 상세의 실제 데이터 경로는 브라우저 검증하지 못했다. 해당 UI는 타입/린트 검증 대상이다. 실제 사진 로딩 실패도 승인된 사진 자체가 없어 해당 없음이다.
- 프로덕션 빌드·전체 E2E·DB/마이그레이션 검사는 미실행: 본 단계 관련 검사에 한정했다. 3단계의 전체 통합 검증 완료로 표현하지 않는다.

## 직접 화면 확인

기존 개발 서버는 http://127.0.0.1:3000 이다. 서버가 없으면 프로젝트에서 `pnpm dev` 실행. 기존 fixture DB가 없는 새 환경에서는 `pnpm db:seed`가 필요하며 이번 작업에서는 기존 DB를 변경하지 않았다.

- `/players/demo_0_00?window=5`: 타자 상단과 기존 기세 분석.
- `/players/demo_0_00?window=5&tab=season`: 타자 시즌 지표·wRC+ 설명·미제공 상태.
- `/players/demo_0_12?role=starter&window=5&tab=season`: 겸업 투수 시즌 전체 기록.
- 같은 투수의 기세 분석 탭에서 기록 역할을 불펜으로 변경한 뒤 시즌 탭 확인: 전체 시즌 기록은 동일.
- `/players/demo_0_00?season=2025`: 미지원 시즌 상태.
- `/players/demo_0_00?competition=postseason`: 미지원 대회 상태.
- `/players/demo_0_00?kind=pitching`: 지원하지 않는 역할의 빈 상태.
- `/players/demo_0_00?tab=invalid`: 잘못된 탭 복구.

## 남은 제한과 다음 단계

실제 데이터에는 공급 계약과 필드별 승인/출처/기준일, 사진에는 별도 사용 권한이 필요하다. wRC+는 공급값 또는 검증된 리그·구장 보정 데이터와 계산법이 모두 필요하다. 게시 기록에 시즌 일반 기록을 연결하려면 게시 시점/범위가 일치하는 원천 연결이 필요하다.

2단계까지 완료. 3단계의 통합 검증·필요한 추가 보완은 사용자 화면 확인 및 다음 단계 요청 후 진행한다.
