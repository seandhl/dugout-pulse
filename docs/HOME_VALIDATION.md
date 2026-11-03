# 홈 구현 검증 · 2026-11-03

## 수행 작업 및 변경 파일

- `src/app/(public)/page.tsx`, `src/components/features/home-dashboard.tsx`: 핵심 소개, 팀/선수 검색, 상태 바, 역할 tabs, 최근 3/5/10/20경기 전환, TOP5 및 제외 사유, 표본 기반 분석 카드, 한계·비교 CTA.
- `src/contracts/home.ts`, `src/server/reads/home.ts`, `src/app/api/v1/home/route.ts`: canonical fixture를 기존 역할별 momentum 계산기에 연결하는 입력/출력 검증 API.
- `src/app/globals.css`: 모바일 1열, 중간 화면 2열, 데스크톱 3열, 스크롤 중 유지되는 대문자 DEMO.
- `src/app/(public)/players/[id]/page.tsx`: 기존 모델 미구현 문구를 홈의 실험용 모델 안내로 수정.
- `tests/e2e/home.spec.ts`: 반응형·검색·역할/기간·접근성·첫 상세 이동 및 API 검증.
- `docs/API_CONTRACT.md`, `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`: 계약·선정 근거·가정 기록.

## 실행 결과

- `pnpm db:seed`: 성공. 외부 수집·패키지 설치 없음.
- `pnpm lint`: 성공.
- `pnpm typecheck`: 실패. 기존 `prisma.config.ts`에서 설치되지 않은 `prisma/config` 모듈 TS2307. 패키지 설치 금지 경계에 따라 설치하지 않음.
- `pnpm test`: 187 성공, 기존 momentum-snapshots 테스트 1개 5초 초과로 실패.
- `pnpm exec vitest run --testTimeout=20000`: 13개 파일 / 188개 테스트 모두 성공.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/home.spec.ts --workers=1`: 3개 성공. 모바일/데스크톱 첫 선수 상세 이동, 역할·기간·검색, axe 위반 없음, 가로 넘침 없음, API 유효성 검증 포함.
- 최초 개발 서버와 Chromium은 sandbox 권한으로 실행되지 않아 로컬 검증 권한으로 재실행했다. 최초 fixture 완료 상태 대소문자 오류와 긴 선발 기간을 무조건 순위가 있다고 가정한 E2E는 수정 후 재검증했다.

## 화면 확인

`pnpm db:seed`, `pnpm dev --port 3100` 후 `/` 접속. 390×900과 1440×900에서 캡처를 열어 세로 카드/3열 카드, 문구, 메타데이터를 시각 검토했다. 캡처는 `test-results/home-390.png`, `test-results/home-1440.png`에 생성한다. 역할 tabs와 기간을 바꾼 뒤 첫 카드 선택 시 같은 ID의 상세 화면이 열린다.

## 제한 및 다음 단계

- 전부 가상 DEMO. 실제 데이터, 현재 등록 상태, 공식 시즌 진행 여부는 제공하지 않는다.
- 검색은 선택한 역할 내 팀/선수명 부분 일치. 표본 부족·미산출·낮은 신뢰도는 순위에서 제외하며 상세 목록에서 확인 가능하다.
- TOP5는 기세 점수 순위로 상승폭 순위가 아니다. 5명을 충족하지 못하면 실제 대상만 표시한다.
- 비교 CTA의 목적지는 기존 개발 미리보기이며 실제 비교 분석은 이번 범위가 아니다.
- 첫 방문자 5초 이해 여부의 사용자 실험은 미실행. 핵심 문구와 화면 배치를 구현·시각 검토한 결과만 보고한다.
- 다음 단계 전 타입 검사 의존성 문제 해결 및 실제 비교 기능의 별도 수락 기준 정의가 필요하다. 커밋·푸시는 수행하지 않았다.
