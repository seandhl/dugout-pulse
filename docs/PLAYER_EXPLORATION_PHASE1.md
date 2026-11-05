# 선수 탐색 경험 — 1단계 검증 (2026-11-05)

## 수행 작업과 변경 파일

- `src/components/features/player-directory.tsx`: 기존 중립 아바타, 소속/역할, 포지션 미제공, 고유 기세 점수 안내, 카드 전체 클릭. 기존 화살표/Enter 및 복원 코드를 유지.
- `src/components/features/home-dashboard.tsx`: 주요 선수 카드에 같은 아바타·포지션 미제공·고유 점수 설명 적용.
- `src/app/(public)/rankings/page.tsx`: 기존 순위 선수 셀의 아바타·역할·포지션 미제공, 선수 셀 클릭 영역 확장. 점수 근거의 펼침 컨트롤 유지.
- `src/app/globals.css`: 카드/셀의 기본 링크 클릭 영역·키보드 초점·아바타 배치와 줄바꿈.
- `tests/e2e/player-identity.spec.ts`: 320/1440px 접근성·가로 넘침·클릭·Enter·뒤로가기 URL/초점, 홈 카드와 게시 랭킹 상태 검증.
- `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`, 이 문서: 단계 경계와 데이터 제약 기록.

## 데이터 구분

실제 데이터 연결 없음. 기존 자체 제작 2026 정규시즌 fixture만 사용하며 DEMO를 유지한다. 점수 계산·API·스키마·fixture 변경 없음. 사진·주 포지션 미제공이며 외부 이미지 요청 없이 기존 자체 도형 아바타로 통일한다. 사진 URL 입력 기능은 도입하지 않았다. 이미지 부재/실패에 따른 깨진 이미지는 발생하지 않으며 향후 사진 연결 시 권리 증빙 및 오류 대체 검증이 필요하다. wRC+ 및 리그/구장 보정 데이터는 미확보이며 2단계에서 추정 없이 빈 상태로 표시할 계획이다.

## 검사 결과

- `pnpm typecheck:app`: 통과.
- `pnpm lint`: 통과.
- `pnpm exec vitest run tests/unit/player-directory.test.ts tests/unit/ranking-boards.test.ts tests/unit/player-detail.test.ts tests/unit/pitcher-detail.test.ts`: 4파일, 27테스트 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/player-identity.spec.ts --workers=1`: 최종 3테스트 통과. 320/1440px axe 위반 0, 가로 넘침 없음, 카드 여백 클릭·Enter 이동·뒤로가기 조건/초점 복원 통과.
- 변경 TSX/CSS/e2e 파일의 `prettier --check` 및 `git diff --check`: 통과.
- `test-results/player-identity-320.png`, `test-results/player-identity-1440.png`: 브라우저 화면 캡처. 데스크톱 카드 배치 육안 확인.
- 초기 E2E: Chromium 권한 제한으로 실행 실패. 권한 있는 실행으로 재시도했으나 새 3100 서버가 기존 3000 개발 서버와 같은 빌드 디렉터리를 사용해 종료되어 연결 실패. 기존 3000 서버로 전환했다. 사용자 서버 종료/DB 재시드 없음.
- 첫 실제 화면 검사: 랭킹의 채워진 행 기대 실패. 현재 게시 스냅샷이 없는 환경임을 확인하고 미갱신 상태를 검증하도록 수정했다. 최종 테스트에서 채워진 랭킹 행의 클릭은 실행되지 않았다. 해당 표시 코드는 타입/린트 검사만 통과했으며 게시 fixture 환경의 시각 검증이 후속 필요하다.
- 전체 E2E/프로덕션 빌드/DB 검사는 미실행: 이번 UI 단계의 변경 범위에 맞춰 관련 단위·브라우저 검사를 수행했다.

## 화면 확인과 다음 단계

이미 실행 중인 서버: http://127.0.0.1:3000 . 서버가 없으면 `pnpm dev` 실행.

- `/players?role=starter&sort=score&window=5&team=sample_0`: 카드 클릭 → 기존 상세 → 브라우저 뒤로가기. 필터·정렬·초점 확인.
- `/`: 최근 기세 상위 선수와 출전 기록이 충분한 선수 카드 확인.
- `/rankings`: 현재는 게시 스냅샷 부재로 기록 미갱신. 임의 게시나 다른 날짜 점수 대체 없음.

2단계(기존 상세의 기세 분석/시즌 기록 탭)와 3단계(통합 상태/모바일 검증)는 아직 진행하지 않았다. 사용자 화면 확인 및 다음 단계 요청 후 진행한다. 실제 사진은 사진별 사용 권한과 승인된 자산 정보, 실제 기록은 공급 계약 및 필드별 출처가 필요하다.
