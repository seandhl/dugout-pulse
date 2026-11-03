# R06/R07/R09 변경·검증 기록

2026-11-03 (Asia/Seoul). 코드 수락 기준 확인이며 실제 데이터 연동·출시 승인이나 사용자 조사 완료를 뜻하지 않는다.

## 기준 상태와 수행 작업

- 시작 브랜치: `codex/team-record-scope-review`, 커밋 `6f72cd03620f4ca8278b8c0673437d30f9deac8c`.
- 작업 브랜치: `codex/r06-r07-r09-comparison-scope`. 커밋·push·배포 없음.
- 실제 Git 루트는 프로젝트 디렉터리다. 홈 파일 탐색·수정 없음. 시작 시 문서/랭킹/탐색 관련 수정 17개와 신규 `momentum-version.ts`가 이미 있었으며 유지했다.
- 실제 package.json, AGENTS.md, PRD, DECISIONS, 공개 contracts, 비교·상세·탐색·랭킹 read/페이지, 관련 검증 문서와 설치된 Next 16.4.4의 page/useSearchParams 가이드를 확인했다.
- 기세 변화량은 이전 순위 적격 게시 점수 대비로 통일했다. 모델 내부 delta는 최신 출전 하나를 제외한 N출전의 **모델 내부 이동 창 점수차**로 구분했다.
- comparisonBasis로 현재/이전 양쪽의 시즌·대회·역할·창·모델 버전·snapshot/asOf·provenance를 전달한다. 이전 게시 선택 시 algorithmVersion과 modelVersion 모두 일치해야 한다.
- 3슬롯 이상 요청은 URL·read 양쪽에서 명시적으로 거부한다. 선수 ID를 2개 이하로 줄이라는 수정 안내와 초기화 링크를 제공한다.
- 탐색은 시즌 출전 선수 목록이며 등록 여부는 unknown이다. 등록 snapshot/asOf/source도 null로 반환해 출전 기록을 등록 증거로 취급하지 않는다. 현재 등록 필터를 비활성화하고 이유를 설명한다.
- 탐색·상세·비교·랭킹에 2026 정규시즌 DEMO 제약을 표시한다. 미지원 URL은 오류 또는 기존 기록 없음/비교 제외 상태로 표시한다.

## 변경 파일

이번 변경이 들어간 파일 목록이다. 기존 미커밋 변경도 포함된 파일에서는 이번 변경 hunk만 해당한다.

- 계약: `src/contracts/comparison-basis.ts`(신규), `momentum.ts`, `player-directory.ts`.
- read: `src/server/reads/comparison-basis.ts`(신규), `compare.ts`, `momentum.ts`, `ranking-boards.ts`, `player-directory.ts`, `player-detail.ts`, `pitcher-detail.ts`.
- 화면: `src/app/(public)/compare/page.tsx`, `rankings/page.tsx`, `about/page.tsx`, `src/components/score-help.tsx`, `src/components/features/detail-shared.tsx`, `player-directory.tsx`.
- 단위/성능 검증: `tests/unit/compare.test.ts`, `momentum-snapshots.test.ts`, `player-directory.test.ts`, `performance.test.ts`, `tests/performance/baseline-directory.ts`.
- E2E: `tests/e2e/compare.spec.ts`, `players.spec.ts`.
- 문서: `docs/PRD.md`, `DECISIONS.md`(ADR-032), `API_CONTRACT.md`, `DATA_DICTIONARY.md`, `ASSUMPTIONS.md`, 이 기록 및 RELEASE_REPORT 링크.

## 설계·마이그레이션 결정

ADR-032 채택. 점수 산식·modelVersion·저장 fixture·기존 snapshot ID와 수치는 유지한다. 비교 근거는 읽기 시 투영하므로 DB/저장 JSON 마이그레이션이 필요 없다. 공개 응답은 필드 추가이며 strict allowlist 소비자는 comparisonBasis/registration을 수용해야 한다. 이전 게시가 없으면 previous=null, 자료가 있어도 결측/부족 표본이면 기존 delta/status에 따라 비교 불가다. 모델 창 snapshotId는 fixture release ID이며 각 창은 inputRefs로 구분한다.

## 실행 명령과 실제 결과

| 명령 | 실제 결과 |
| --- | --- |
| `pnpm exec vitest run` | 최종 26파일, 254 통과 / 1 skip, 10.81초 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3196 pnpm exec playwright test tests/e2e/compare.spec.ts tests/e2e/players.spec.ts tests/e2e/rankings.spec.ts --workers=1` | 최종 production build 대상 Chromium 10 통과, 12.6초 |
| `pnpm typecheck` | 종료 0, Next typegen 및 전체 tsc 통과 |
| `pnpm lint` | 종료 0, 경고 허용 0 |
| `pnpm build` | 종료 0, webpack production compile/typecheck/정적 생성 통과 |
| `git diff --check -- .` | 종료 0 |

단위 검증은 3슬롯·빈 슬롯·중복 URL 값·unknown field, read 직접 호출, 미지원 시즌/대회·역할·없는 ID, 빈 경기·0분모·결측, 현재/이전 창 provenance와 중첩 수, 등록 unknown 계약, 이전 게시 근거·저장 불변·버전 혼합 제외를 포함한다. E2E는 기존 역할/결측/공유·새로고침·Back 흐름에 3명 거부, URL 중복/등록 조작, Back/Forward 복원, 모바일/데스크톱 axe 및 가로 넘침 검증을 포함한다. 390px 탐색 캡처를 직접 확인했다.

실패 이력도 보존한다. 초기 단위 테스트는 추가 응답 필드 때문에 기존 완전 일치 기대값 3건이 실패했고, 계약 필드와 저장 스냅샷을 구분하도록 보완했다. 샌드박스 내 서버 포트/Chromium 실행은 EPERM으로 시작 실패했으며 실행 권한을 확보해 재검증했다. E2E 최초 신규 테스트는 Next 경로 알림까지 선택했고, 다음 실행에서는 탐색 완료 전에 Back을 실행해 실패했다. 오류 요소를 특정하고 각 탐색 결과가 표시된 후 이력을 이동하도록 수정했다. 최종 production E2E는 모두 통과했다. 추가 성능 검증에서 0ms 타이머 tick=0으로 1회 실패했으며, 이벤트 루프 check 단계의 양보를 직접 관측하는 setImmediate probe로 안정화하고 전체 단위를 재통과했다.

로그(로컬 임시 파일): `/tmp/dugout-r069-unit-full-final.log`, `/tmp/dugout-r069-e2e-final.log`, `/tmp/dugout-r069-typecheck-final.log`, `/tmp/dugout-r069-lint-final.log`, `/tmp/dugout-r069-build-final.log`.

## 화면 확인 방법

기존 DEMO DB를 사용해 `pnpm start --port 3196`(개발은 `pnpm dev --port 3196`) 후 아래 경로를 연다. 이번 검증에서는 seed/reset을 실행하지 않았다.

- `/compare?players=demo_0_00,demo_0_01,demo_0_02`: 최대 2명 오류·수정 안내·조건 초기화. 2명 데이터가 대신 표시되면 안 된다.
- `/compare?players=demo_0_10,demo_0_11&window=5`: 역할별 동일 조건 비교와 펼칠 수 있는 모델 내부 이동 창 비교 근거.
- `/compare?players=unknown,demo_0_00`: 첫 슬롯 제외 안내, 두 번째 선수 유지.
- `/players`: 시즌 출전 범위·현재 1군 등록 비활성 이유·카드 등록 여부 미확인·DEMO 한계.
- `/players?membership=current` 또는 `?role=hitter&role=starter`: 유효하지 않은 조건 안내, 결과 없음.
- `/rankings`: 기세 변화량 설명과 각 표시 행의 현재/이전 게시 스냅샷 근거. 기존 DB에 게시 자료가 없으면 빈 상태를 유지한다.
- 선수 선택 후 Back/Forward로 두 슬롯과 URL 복원, 390px/1440px에서 확인한다. 캡처: `test-results/players-390.png`, `players-1440.png`.

## 알려진 제한·미실행

- 2026 정규시즌 합성 데이터만 지원한다. 외부 수집·패키지 설치·계정 연결·비용·DNS·실데이터 게시 없음.
- 탐색 fixture의 등록 snapshot이 없으므로 현재 1군 목록은 미지원이다. 별도 게시 저장소의 등록 자료를 임의 결합하지 않는다.
- 기세 변화량은 이전 적격 게시가 있어야 제공된다. 모델 내부 이동 창 점수차로 대신 채우지 않는다. 일부 fixture의 OPS 필수 항목 결측은 계속 미제공이다.
- 전체 E2E/ingest E2E, 실제 데이터 연동, 성능 벤치마크(`PERFORMANCE=1`), 실사용자·실기기/스크린리더 검수는 이번 범위에서 미실행이다. 기본 단위 실행의 성능 측정 1개는 설정에 따라 skip이다.
- 새 응답 필드가 있어도 산출 불가 값은 null을 유지한다. 앱 테스트 통과는 데이터 공급 권한이나 출시 완료를 뜻하지 않는다.

## 되돌리는 방법·다음 단계 조건

저장 데이터 변경이 없어 데이터 복구는 필요 없다. 시작부터 있던 미커밋 변경이 있으므로 `git reset --hard`, 파일 전체 checkout/restore는 사용하지 않는다. 이번 diff hunk만 역적용하고 신규 comparison-basis 두 파일의 import/참조를 함께 제거한다. 다른 작업에서 만든 momentum-version.ts는 유지한다. 계약 소비자와 화면을 함께 이전 형태로 돌린 뒤 관련 단위·E2E·typecheck·lint·build를 다시 실행한다. Next가 바꾼 next-env.d.ts는 시작 상태로 복원한다.

다음 단계는 이 브랜치 diff와 ADR-032 검토 후 진행한다. 등록 필터 활성화에는 승인된 출처·효력일·시즌·등록 snapshot 계약과 등록/미등록/미상·미출전 회귀 검증이 필요하다. 실제 시즌/대회 확대와 데이터 게시에는 별도 공급 권리 승인과 계약·fixture·E2E가 필요하다.
