# 차트·경기 로그 검증 (2026-11-03)

## 구현 및 변경 파일

- `src/components/features/game-analysis.tsx`: 공통 차트·tooltip·선택 행 포커스·상대/날짜/유효 지표 표시 필터·대체 표·CSV 권한 차단. 원/사각/삼각 및 실선/점선으로 색각 보완.
- `src/components/features/player-detail.tsx`, `pitcher-detail.tsx`: 기존 기간 API와 로딩/오류/재시도 흐름을 유지하며 분석 뷰 연결. 투수 역할/IP/개인 결과 유지.
- `src/server/reads/player-detail.ts`, `pitcher-detail.ts`: 경기 상대·서버 통계·DEMO exportPolicy 추가. DB 스키마 변경 없음.
- `src/app/globals.css`: 반응형 차트·제어 요소·표 내부 스크롤·선택 행·reduced-motion 처리.
- `tests/unit/game-analysis.test.ts`, `tests/e2e/game-analysis.spec.ts`: 서버 엔진·원천·DH·값·포커스·모바일·CSV·접근성·빈 상태·로딩 검증. 기존 player-detail E2E의 비교 화면 기대 문구를 현재 화면에 맞춤.
- 계약·결정·가정: `API_CONTRACT.md`, `DECISIONS.md` ADR-024, `ASSUMPTIONS.md`.

## 실행 결과

- `pnpm db:seed`: canonical DEMO seed 성공.
- `pnpm test`: 19 파일, 206 테스트 통과.
- `pnpm lint`: 통과.
- 변경 TSX/TS/CSS 및 테스트에 대한 `pnpm exec prettier --check ...`: 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/game-analysis.spec.ts tests/e2e/player-detail.spec.ts tests/e2e/pitcher-detail.spec.ts`: 초기 sandbox에서는 Chromium 권한 오류. 제한 밖 실행에서 8/9 통과 후 기존 비교 검사 제목 선택자를 수정. `... playwright test tests/e2e/player-detail.spec.ts` 재실행 2/2 통과. 최종 고유 9개 시나리오 모두 통과.
- axe 검사 통과. 390px 실제 데이터, 320px 긴 이름 fixture에서 문서 scrollWidth <= innerWidth 검증. `test-results/analysis-mobile.png` 렌더를 직접 확인. 넓은 상세 표는 내부 가로 스크롤로 전체 열을 접근하며 페이지 자체 가로 넘침 없음.
- `pnpm typecheck`: 실패. 기존 `prisma.config.ts:1`의 `prisma/config` 모듈이 현재 설치되어 있지 않음(TS2307). 패키지 설치 금지에 따라 수정/설치하지 않음. 다른 TypeScript 오류는 출력되지 않았으나 전체 타입 검사 통과로 간주하지 않음.
- production build는 미실행: 전체 타입 검사 차단이 남아 있음.

## 화면 확인 방법과 제한

`pnpm db:seed` 후 `pnpm dev`로 `/players/demo_0_00?window=season` 및 `/players/demo_0_10?role=starter&window=5`를 확인한다. 차트 점 hover/focus로 날짜·DH·상대·raw·PA/BF/outs 및 세 통계를 읽고 클릭/Enter/Space로 선택 행에 이동한다. 지표와 표시 필터를 바꾸고 CSV 및 기간 로딩을 확인한다.

DEMO 전용이며 실제 외부 라이선스 adapter는 미연동이다. 외부 데이터 수집·패키지 설치·커밋·푸시 없음. 날짜/상대 필터는 기존 계산 기간을 유지하는 표시 필터다. 누적/이동 비율을 필터 이후 새로 합산하지 않는다. N/A 지표는 없는 기록을 생성하지 않는다. 다음 단계는 기존 Prisma 의존성 환경 복구 후 전체 typecheck/build 확인과, 승인된 외부 source license exportAllowed 검증 adapter 연결이다.
