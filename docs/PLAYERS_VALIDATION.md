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
