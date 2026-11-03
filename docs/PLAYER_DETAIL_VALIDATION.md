# 타자 상세 검증 · 2026-11-03

- 구현: 설명 중심 프로필, 4개 지표/시즌 차이/표본, URL 기간 탭, 기존 모델의 점수·기여·신뢰도·미산출, 경기표, 단일 지표 누적/5출전 합산 추이, 원천 추적, 공유/뒤로/비교 전달.
- 변경: player-detail read/component, batting 상세 API, 선수 상세/비교 page, globals.css, 단위/E2E 테스트, DECISIONS/ASSUMPTIONS.
- `pnpm test`: 15개 파일, 195개 테스트 통과. 원시 합산 및 결측·빈 기록 검증 포함.
- `pnpm lint`: 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/player-detail.spec.ts`: 기존 로컬 서버 사용. 모바일 API/화면 일치, 기간 키보드, axe, 넘침, compare 전달 및 데스크톱 오류 재시도·시즌 전체 검증.
- `pnpm typecheck`: 실패. 기존 prisma.config.ts의 prisma/config 모듈 미설치(TS2307). P0 패키지 설치 금지에 따라 변경하지 않음. 앱 전체 타입 검사 통과로 보고하지 않음.
- 화면: `pnpm db:seed`, `pnpm dev --port 3100` 후 `/players/demo_0_00?window=10`. 모바일 스크린샷은 test-results/player-detail-mobile.png.
- 제한: DEMO 2026 정규시즌만. 엔트리/사진/주 포지션 미확인. HBP/SF 원시 결측으로 OBP/OPS N/A. 시즌 전체 기세 미제공. 비교는 URL 기반 최대 두 타자 요약이며 영구 저장 없음.
- 다음 단계: 공급 계약/원시 필드 확보 후 실제 데이터 adapter 검증, 기존 Prisma 의존성 복구 후 전체 타입 검사와 빌드 확인.
