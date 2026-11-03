# Phase 2 GitHub 반영 준비 · 2026-11-04 (Asia/Seoul)

## 저장소·이력 확인

실제 Git 루트는 `/Users/seandhlee/projects/dugout-pulse`다. AGENTS.md의 홈 Git 루트 설명은 현재 상태와 다르며 홈 파일은 탐색·수정·스테이징하지 않았다.
origin은 `https://github.com/seandhl/dugout-pulse.git`다. fetch 및 ls-remote로 확인했다.

- main / origin/main: `1ae00bd939e83de14b5ca98eda76473ce6ec30fb`
- codex/fix-verify-ci / origin/codex/fix-verify-ci: `6f72cd03620f4ca8278b8c0673437d30f9deac8c`
- main 대비 CI 브랜치: 뒤처짐 0, 추가 2커밋. `465e42d`(Verify 서버/base URL 수정), `6f72cd0`(검증 증거 문서).
- 시작 브랜치: codex/data-provider-decision. 다른 Phase 2 로컬 브랜치들도 모두 같은 `6f72cd0`를 가리켰다. 별도 구현 커밋은 없고 변경은 작업 트리의 수정·미추적 파일에 있었다.
- 안전 작업 브랜치: `codex/phase2-a01-c01-review`. 기존 HEAD에서 생성해 CI 수정 2커밋을 보존한다. main 및 CI 브랜치는 HEAD의 조상이다. 이 시점 별도 병합·충돌 해결이 필요하지 않다.
- force push, reset, rebase, 기존 파일 삭제·덮어쓰기 및 main 병합은 수행하지 않는다.

## 실제 확인한 기능과 범위

A01·C01 번호의 명세/수락 기준은 저장소 검색에서 찾지 못했다. 따라서 아래 구현을 번호별 완료로 추정하지 않는다. B01은 별도 검증 문서가 있다.

| 구현 묶음 | 실제 파일 | 상태·한계 |
| --- | --- | --- |
| UX 감사 | docs/UX_AUDIT_PHASE2.md, docs/qa/phase2/ | 기존 DEMO 화면·JSON 증거. 이번 실행 증거와 구분 |
| 랭킹·팀 범위 | reads/ranking-boards.ts, reads/player-directory.ts, 관련 페이지·테스트 | 원값 정렬/공동 순위, 팀별 최근 출전 기록과 전체 기세 구분 |
| 탐색 | features/player-directory.tsx, contracts/player-directory.ts, API route | 검색·필터·표본, 등록 여부 미확인. 2026 정규시즌 DEMO 한정 |
| 비교 | features/compare-picker.tsx, compare/page.tsx, reads/compare.ts | 15명 단위 후보, 슬롯/교환, 2명 제한, asOf 불일치 차단 |
| 비교 기준·기세 UX | comparison-basis 계약/read, momentum 관련 read, detail-shared/home/detail/game-analysis, ui/game-timeline.ts | 이전 게시 대비와 이동 창 구분, 표본·출처·기준일·달력 공백·N/A 표시 |
| B01 시각 시스템 | globals.css, components/ui/index.tsx, visual-system.spec.ts 및 40 PNG | 테마·조작 크기·접근성·반응형 회귀. 기존 macOS 기준선 유지 |
| R10 공개 읽기 경계 | repositories/publication.ts, db/demo.ts, ingest/pipeline.ts·service.ts | 부분 구현. 미연결 게시 후 503 차단. 통합 릴리스/projection 정상 전환은 미완료 |
| 공급 경로 | docs/DATA_PROVIDER_DECISION.md, DATA_RIGHTS.md, DECISIONS.md | 조사·문의 초안만. 계약/발송/REAL 연동 없음 |

## 안전 검토

명시적 파일 목록만 스테이징했다. `.env*`(값 없는 기존 `.env.example` 제외), API 키·실제 토큰·DB 비밀·로컬 데이터는 추가하지 않는다. `.demo`, reports, node_modules, .next, coverage, test-results, playwright-report는 제외한다. `next-env.d.ts`의 기존 자동 생성 변경도 커밋에서 제외하고 작업 트리에 보존한다.
전체 tracked/untracked 비무시 파일 377개의 금지 경로·대표 private-key/GitHub-token/AWS-key/JWT 패턴 검색은 0건이었다. 추가 민감어 검토 결과는 환경변수 참조와 가상 테스트 capability였다. 이는 전문 비밀 탐지 도구의 완전한 감사와 동일하지 않다. QA PNG/JSON과 시각 회귀 기준선은 DEMO 개발 증거로 포함하며 로컬 DB/실기록 파일과 구분한다.

## 이번 실행 검증

- `pnpm lint`: 통과.
- `pnpm typecheck`: 통과.
- `pnpm test:core`: 30파일, 270 통과 / 성능 benchmark 1 skip. 핵심 5파일 named-function coverage 각 100%, 기준 85% 통과. line/branch coverage가 아니다.
- `pnpm build`: 통과.
- `git diff --cached --check`: 통과.
- `node scripts/validate-migrations.mjs`: exit 1. TEST_DATABASE_URL(일회용 PostgreSQL) 미설정으로 SQL 실행 전 중단. 전체 verify 성공으로 표시하지 않는다. GitHub Verify에서 재확인해야 한다.
- 브라우저 검증: 원본 .demo 보존을 위해 /tmp 복사본, 기존 node_modules 심볼릭 링크, 독립 DEMO 저장소로 production build/E2E 실행. 공개 E2E 57개 중 49 통과 / B01 시각 회귀 8 실패(2.6분, exit 1). 4개 폭 × 두 테마 모두 홈 첫 PNG 비교에서 실패해 뒤의 경로별 PNG 검증까지 도달하지 못했다. 예: 320px light 예상 높이 4703px / 실제 4992px, 90951픽셀 차이. 후속 기세 설명 변경과 기준선 불일치 가능성이 있으나 원인 확정·이미지 승인/갱신은 미수행이다. 기준선은 임의 갱신하지 않았다. Linux CI는 픽셀 비교 대신 기능·접근성 검사와 캡처를 수행하므로 이 macOS 실패를 CI 성공으로 해소했다고 해석하지 않는다.
- 임시 복사본의 첫 pnpm 호출이 자동 의존성 확인을 시도했으나 심볼릭 링크 hoist 디렉터리 오류로 설치 실패했다. 패키지 설치 성공 없음. 이후 임시 복사본에만 verifyDepsBeforeRun=false를 설정했다. 원본 패키지/lockfile 변경 없음.

- `pnpm test:ingest:e2e` (임시 복사본): 2 통과 / 1 실패, 17.7초, exit 1. `tests/e2e/ingest.spec.ts:141`에서 게시 후 `/api/v1/published` 응답의 `aggregates`가 없어 Object.values가 TypeError로 실패했다. R10의 게시 후 공개 읽기 차단 정책과 기존 정상 공개 계약의 불일치 가능성이 있다. 통합 게시 구현/계약 결정 없이 테스트 기대값을 완화하지 않았다. 이는 CI 실패 예상 항목이며 해결 전 병합을 차단해야 한다.

## 화면 확인·다음 단계

`pnpm dev --port 3198` 후 `/`, `/players`, `/players/demo_0_00?window=20`, `/players/demo_0_10?role=starter&window=5`, `/rankings`, `/compare?players=demo_0_00,demo_0_03`을 확인한다. DEMO·N/A·표본·기준일·출처와 320/375/768/1440px 및 라이트/다크를 검수한다. 기존 로컬 DB를 초기화하지 않는다.

PR은 draft로 생성하고 main은 자동 병합하지 않는다. 번호별 원래 수락 기준, R10 통합 게시, 실데이터 권리/공급, 실제 운영 공개 고지·보안 감사·모바일 실기기/스크린리더 및 사용자 검수는 별도 확인이 필요하다. CI 성공이 이 수동 게이트를 대체하지 않는다. 다음 단계는 PR 차이 검토와 CI 확인 후 미완료 항목별 수락 기준 확정이다.

## 이번 반영 파일 목록

- `docs/API_CONTRACT.md`
- `docs/ASSUMPTIONS.md`
- `docs/B01_VISUAL_SYSTEM.md`
- `docs/DATA_DICTIONARY.md`
- `docs/DATA_PROVIDER_DECISION.md`
- `docs/DATA_RIGHTS.md`
- `docs/DECISIONS.md`
- `docs/MOMENTUM_UX_VALIDATION.md`
- `docs/PLAYERS_VALIDATION.md`
- `docs/PRD.md`
- `docs/R06_R07_R09_VALIDATION.md`
- `docs/R10_PUBLICATION.md`
- `docs/R16_COMPARE_VALIDATION.md`
- `docs/RANKINGS_VALIDATION.md`
- `docs/RELEASE_REPORT.md`
- `docs/UI_SYSTEM.md`
- `docs/UX_AUDIT_PHASE2.md`
- `docs/qa/phase2/1440-compare-viewport.png`
- `docs/qa/phase2/1440-compare.png`
- `docs/qa/phase2/1440-detail-viewport.png`
- `docs/qa/phase2/1440-detail.png`
- `docs/qa/phase2/1440-home-viewport.png`
- `docs/qa/phase2/1440-home.png`
- `docs/qa/phase2/1440-offline.png`
- `docs/qa/phase2/1440-players-viewport.png`
- `docs/qa/phase2/1440-players.png`
- `docs/qa/phase2/1440-rankings-viewport.png`
- `docs/qa/phase2/1440-rankings.png`
- `docs/qa/phase2/320-compare.png`
- `docs/qa/phase2/320-detail.png`
- `docs/qa/phase2/320-home.png`
- `docs/qa/phase2/320-players.png`
- `docs/qa/phase2/320-rankings.png`
- `docs/qa/phase2/375-about.png`
- `docs/qa/phase2/375-compare-empty.png`
- `docs/qa/phase2/375-compare-pitchers.png`
- `docs/qa/phase2/375-compare-two.png`
- `docs/qa/phase2/375-compare.png`
- `docs/qa/phase2/375-detail.png`
- `docs/qa/phase2/375-home.png`
- `docs/qa/phase2/375-keyboard.png`
- `docs/qa/phase2/375-pitcher.png`
- `docs/qa/phase2/375-players-dark.png`
- `docs/qa/phase2/375-players-empty.png`
- `docs/qa/phase2/375-players-error.png`
- `docs/qa/phase2/375-players-invalid.png`
- `docs/qa/phase2/375-players-loading.png`
- `docs/qa/phase2/375-players.png`
- `docs/qa/phase2/375-published.png`
- `docs/qa/phase2/375-rankings-empty.png`
- `docs/qa/phase2/375-rankings.png`
- `docs/qa/phase2/430-compare.png`
- `docs/qa/phase2/430-detail.png`
- `docs/qa/phase2/430-home.png`
- `docs/qa/phase2/430-players.png`
- `docs/qa/phase2/430-rankings.png`
- `docs/qa/phase2/768-compare.png`
- `docs/qa/phase2/768-detail.png`
- `docs/qa/phase2/768-home.png`
- `docs/qa/phase2/768-players.png`
- `docs/qa/phase2/768-rankings.png`
- `docs/qa/phase2/evidence.json`
- `docs/qa/phase2/extra-evidence.json`
- `docs/qa/phase2/interaction.json`
- `docs/qa/phase2/manifest.json`
- `scripts/momentum-ux-performance.mjs`
- `src/app/(public)/about/page.tsx`
- `src/app/(public)/compare/page.tsx`
- `src/app/(public)/rankings/page.tsx`
- `src/app/api/v1/player-directory/route.ts`
- `src/app/api/v1/players/[id]/batting/route.ts`
- `src/app/api/v1/players/[id]/pitching/route.ts`
- `src/app/globals.css`
- `src/components/features/compare-picker.tsx`
- `src/components/features/detail-shared.tsx`
- `src/components/features/game-analysis.tsx`
- `src/components/features/home-dashboard.tsx`
- `src/components/features/pitcher-detail.tsx`
- `src/components/features/player-detail.tsx`
- `src/components/features/player-directory.tsx`
- `src/components/score-help.tsx`
- `src/components/ui/index.tsx`
- `src/contracts/comparison-basis.ts`
- `src/contracts/momentum.ts`
- `src/contracts/player-directory.ts`
- `src/server/db/demo.ts`
- `src/server/ingest/pipeline.ts`
- `src/server/ingest/service.ts`
- `src/server/reads/compare.ts`
- `src/server/reads/comparison-basis.ts`
- `src/server/reads/momentum-version.ts`
- `src/server/reads/momentum.ts`
- `src/server/reads/pitcher-detail.ts`
- `src/server/reads/player-detail.ts`
- `src/server/reads/player-directory.ts`
- `src/server/reads/ranking-boards.ts`
- `src/server/repositories/publication.ts`
- `src/ui/game-timeline.ts`
- `tests/e2e/compare.spec.ts`
- `tests/e2e/game-analysis.spec.ts`
- `tests/e2e/home.spec.ts`
- `tests/e2e/momentum-context.spec.ts`
- `tests/e2e/players.spec.ts`
- `tests/e2e/rankings.spec.ts`
- `tests/e2e/visual-system.spec.ts`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-1440-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-320-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-320-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-375-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-375-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-768-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/compare-768-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-1440-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-320-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-320-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-375-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-375-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-768-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/detail-768-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-1440-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-320-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-320-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-375-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-375-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-768-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/directory-768-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-1440-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-320-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-320-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-375-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-375-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-768-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/home-768-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-1440-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-320-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-320-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-375-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-375-light-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-768-dark-chromium-darwin.png`
- `tests/e2e/visual-system.spec.ts-snapshots/rankings-768-light-chromium-darwin.png`
- `tests/performance/baseline-directory.ts`
- `tests/unit/compare-asof.test.ts`
- `tests/unit/compare.test.ts`
- `tests/unit/game-timeline.test.ts`
- `tests/unit/momentum-snapshots.test.ts`
- `tests/unit/performance.test.ts`
- `tests/unit/player-directory.test.ts`
- `tests/unit/publication-api.test.ts`
- `tests/unit/publication.test.ts`
- `tests/unit/ranking-boards.test.ts`
- `docs/PHASE2_GITHUB_HANDOFF.md` (본 문서)
