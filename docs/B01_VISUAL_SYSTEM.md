# B01 시각 시스템 — 2026-11-03

## 근거와 적용 범위

`UX_AUDIT_PHASE2.md`의 UX-10(다크 입력 대비), UX-11(조작 크기), UX-15(시스템 문서)를 근거로 홈·탐색·상세·랭킹·비교의 공통 CSS를 확장한다. 별도의 B01 감사 파일은 발견하지 못했다. 기존 데이터·지표·URL·권한·게시·provenance와 modelVersion은 변경하지 않는다. UX-07 및 R10 해결을 시각 개선의 성과로 간주하지 않는다.

기준: `codex/ux-audit-phase2`, HEAD `6f72cd03620f4ca8278b8c0673437d30f9deac8c` + 기존 미커밋 변경. 작업 브랜치 `codex/b01-visual-system`. 기존 변경을 reset/stash/커밋하지 않는다.

## 토큰과 사용 규칙

| 영역 | 채택 규칙 |
| --- | --- |
| 기본 색상 | 기존 `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--soft` 및 다크 팔레트 유지. 포인트는 녹색 한 계열 |
| 글꼴 | 로컬 한국어 시스템 글꼴. 본문 `--text-body:16px`, 레이블 `--text-label:14px`, 출처 `--text-caption:12px` |
| 위계 | h1 30–48px, h2 21–26px, 수치 `--text-value:32–44px`, 800 weight. 숫자는 전역 tabular-nums, 수치 자간 -0.035em |
| 간격 | 기존 `--space-unit:4px`; 카드 `--space-card:24px`, 모바일 20px. 섹션 간격과 기존 반응형 그리드 유지 |
| 테두리·카드 | `--border-subtle:1px solid var(--line)`, `--radius-card:12px`, `--radius-control:8px`. 장식용 그림자 추가 없음 |
| 표 | 숫자 tabular-nums, 16px 셀 패딩, 수평 스크롤은 표 region 내부. hover soft 배경. 출처·열 이름 보존 |
| 탭·필터 | 44px 이상, 선택 상태에 기존 underline/pressed 의미와 accent/soft 병용. 키보드 Radix 동작 보존 |
| 배지 | DEMO 11px/800, 테두리+soft 배경. DEMO·출처 문구 생략 없음 |
| 상태 | `--rise` 녹색, `--fall` 적색, `--neutral` muted. DeltaBadge는 부호+↑/↓/→와 data-direction 병용. 감소는 성적 악화와 동의어가 아님. null은 산정 대기 |
| 아이콘·가상 팀 | 기존 중립 기호/가상 이니셜만 사용. `--team-bg/--team-ink`는 soft/accent. 공식 팀 색·로고·사진·외부 폰트 도입 없음. 임의 팀별 배색은 제안 상태 |
| 차트 | `--chart-primary:accent`, `--chart-secondary:ink`, `--chart-grid:line`. 공통 sparkline/경기 분석 시리즈/비교 트랙에 적용. 상세 차트는 최소 너비 640px의 키보드 접근 가능한 내부 스크롤 영역으로 표시하여 모바일 축 라벨을 보존하고, 포인트의 투명 터치 원은 반지름 23(실제 최소 46px)으로 확보한다. 원래 축·단위·설명·수치 보존 |
| 접근성 | 조작 영역 44×44 이상, focus outline 유지, scroll-margin 100px, skip link를 sticky 안내보다 앞에 표시. 기존 reduced-motion 전체 애니메이션/전환 중지 유지 |

## 검증과 한계

`tests/e2e/visual-system.spec.ts`는 5개 경로 × 320/375/768/1440px × 라이트/다크에서 axe 전체 위반, 문서 가로 넘침, DEMO, 일반 조작 및 SVG 포인트 크기, PNG 회귀 비교를 검사한다. 초기 baseline 생성은 비교 통과의 근거가 아니며, 동일 환경의 별도 재실행으로 비교한다. macOS Chromium 및 현재 시스템 글꼴 환경의 픽셀 기준이며 브라우저/OS/fixture 변경은 별도 검토가 필요하다. 실제 스크린리더·실기기 검수와 정상 게시 랭킹 행 검수는 별도 조건이다. macOS는 보관 PNG와 픽셀 비교하며 다른 OS에서는 동일 기능·접근성 검사를 실행하고 PNG를 보고서 첨부로 남긴다. Linux 픽셀 비교에는 해당 OS에서 검토한 별도 기준선이 필요하다.

검증 시 기존 `.demo`는 seed/reset/publish하지 않는다. `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3117`로 별도 개발 서버를 지정한다. API 쓰기/관리자 ingest E2E는 이번 데이터 불변 검증 범위 밖이다.

## 변경 파일과 복구

- `src/app/globals.css`: 토큰, 카드/수치 위계, 입력 대비, 최소 조작 영역, 차트 트랙.
- `src/components/ui/index.tsx`: DeltaBadge 방향 속성, sparkline 색상 토큰.
- `src/components/features/game-analysis.tsx`: 차트 시리즈 색상 토큰.
- `src/app/(public)/compare/page.tsx`: 기존 폼과 제출 버튼에 공통 스타일 클래스 추가(필드/URL/계산 동일).
- `tests/e2e/visual-system.spec.ts`, 해당 `-snapshots/`의 40 PNG: 5경로·4폭·2테마 회귀.
- `docs/UI_SYSTEM.md`, `DECISIONS.md`, `ASSUMPTIONS.md`, 이 문서: 근거·결정·제약.

복구는 위 코드의 B01 변경 부분만 역적용하고 신규 spec/40 PNG/이 문서 및 기존 문서의 B01 추가 단락만 제거한다. 비교 페이지와 DECISIONS/ASSUMPTIONS에는 작업 시작 전 변경이 있었으므로 파일 전체 `git restore`, reset 또는 이전 HEAD 덮어쓰기를 하지 않는다. 데이터 rollback/migration은 필요 없다. 수정 전 코드 사본은 현재 세션 `/tmp/dugout-b01-before/`에 보관했지만 영구 백업은 아니다.

다음 단계 조건: 시각 결과 리뷰, 실기기·스크린리더 확인, Linux용 픽셀 baseline 검토, 게시 저장소의 승인된 정상 랭킹 fixture 검증. UX-07·R10 및 실데이터 권리는 별도 진입 조건으로 유지한다. main 병합·push·배포는 수행하지 않는다.

## 검증 중 발견·수정한 사항

- 최초 검사에서 상세 체크박스와 모바일 상단 대시보드 링크가 44px 기준에 미달했다. 연결 레이블과 링크의 실제 영역을 확장했다.
- SVG 포인트도 검사 대상으로 확장했다. 44px 원은 소수점 좌표 반올림으로 일부 44px 미만이 되어 46px 투명 터치 영역으로 보완했다. 차트는 모바일 내부 가로 스크롤을 제공한다.
- 전역 검사에 간헐적으로 포함된 이름 없는 입력을 직접 조사했다. Radix 스위치 내부의 `aria-hidden=true`, `tabindex=-1`, `pointer-events:none`, `opacity:0` 체크박스(초기 13×13)였다. 비가시·비조작 보조 입력은 제외하고 실제 스위치와 일반 체크박스 레이블을 검사한다.
- 기준선 생성 도중의 실패 및 중단 실행은 성공으로 세지 않는다. 초기 전체 실행은 39 통과/4 실패였고, 수정 후의 최종 결과는 아래에 별도로 기록한다.
- QA 축소 이미지 모음 생성은 Python PIL 미설치로 실행하지 못했다. 패키지를 설치하지 않고 원본 PNG를 직접 열어 홈·탐색·상세·랭킹·비교를 확인했다. 이는 앱 테스트 실패가 아니다.

현재 세션의 코드 복구 명령은 `git apply --reverse --check /tmp/dugout-b01-code.patch`로 확인한 뒤 `git apply --reverse /tmp/dugout-b01-code.patch`다. 이 패치는 작업 시작 전 미커밋 변경을 포함하지 않고 이번 코드 변경 4개 파일만 포함한다. 신규 테스트/이미지와 B01 문서 단락 정리는 별도로 수행해야 한다.

## 최종 실행 결과

| 명령 | 실제 결과 |
| --- | --- |
| `pnpm test` | 28파일, 267 통과 / 기존 선택적 성능 테스트 1 skip, exit 0 |
| `pnpm exec vitest run tests/unit/game-analysis.test.ts` | 차트 관련 1 통과, exit 0 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3117 pnpm test:e2e --workers=1` | 수정 후 전체 43/43 통과, 5.8분, exit 0. `--update-snapshots` 없는 독립 실행에서 PNG 40개 비교 성공. axe 위반·문서 가로 넘침·가시 조작 영역 미달 없음 |
| `pnpm typecheck` | route typegen 및 전체 TypeScript 검사 통과, exit 0 |
| `pnpm lint` | 경고 허용 0 설정으로 통과, exit 0 |
| `pnpm build` | production 컴파일·TypeScript·22개 정적 페이지 생성 및 trace 수집 통과, exit 0 |
| `git diff --check` / 변경 코드 Prettier 검사 | 통과 |

초기 전체 E2E 39통과/4실패 → 메뉴/차트 크기 보완 및 비가시 보조 입력 진단 → 최종 전체 43통과다. 최초 실패를 최종 성공으로 재분류한 것이 아니다. E2E는 기존 Chromium과 기존 DEMO 저장소를 사용하는 개발 서버에서 실행했다. seed/reset/publish/설치/외부 수집/계정 연결/커밋/push/배포는 실행하지 않았다. production E2E, 관리자 ingest 쓰기, 실제 스크린리더·실기기, Linux 픽셀 비교는 이번 검증에서 미실행이다. 공통 UI 변경이므로 DB 마이그레이션은 없다.

화면 확인: `pnpm dev` 후 `/`, `/players`, `/players/demo_0_00`, `/rankings`, `/compare?players=demo_0_00,demo_0_03`을 320/375/768/1440px와 두 테마로 확인한다. 차트·표만 내부 가로 스크롤하며 문서 전체는 넘치지 않아야 한다. 회귀 PNG는 `tests/e2e/visual-system.spec.ts-snapshots/`, 최종 실행 보고서는 `pnpm exec playwright show-report`로 연다. 자동 생성 기준선을 승인 없이 갱신하지 말고 기존 수치/DEMO/출처와 함께 비교한다.
