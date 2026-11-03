# PR #1 검증 실패 수정 · 2026-11-04 (Asia/Seoul)

## 원인과 수정

대상 브랜치 `codex/phase2-a01-c01-review`, 시작 커밋 `6b634a3`. 독립 Git 루트가 프로젝트 디렉터리임을 확인했다. GitHub Verify #5의 job 로그와 로컬 관리자 E2E 모두 `ingest.spec.ts:141`의 동일한 TypeError를 재현했다. 원인은 성공한 파일 게시가 revision을 증가시킨 뒤, R10 guard가 공개 API를 503으로 차단하고 테스트가 오류 응답의 aggregates를 읽은 것이다. aggregates 기대값 2→3과 중복 방지 검증은 유지하고 HTTP 성공·릴리스·출처 검증을 추가했다.

## 채택한 설계와 마이그레이션

- 기존 `PipelineState.version=1`에 선택적 `publication` 및 `releases`를 추가했다. 기존 미게시 상태는 그대로 읽는다. 기존 비어 있지 않은 미연결 게시·손상 파일은 계속 503이다. 자동으로 데이터를 삭제하거나 합성 fixture로 돌아가지 않는다. 별도 SQL 스키마 변경은 없다.
- `projectRelease`는 원본 게시 records만으로 선수·팀·경기·역할별 상세/비교/탐색 공통 fixture와 홈 3역할×4기간 projection을 만든다. 랭킹·기세·published·scope용 public state도 같은 릴리스 안에 고정한다. 없는 역할과 출전은 빈 결과이며 기존 합성 선수로 채우지 않는다.
- manifest는 schemaVersion, releaseId, revision, asOf, modelVersion, sourceIds, licenseIds, projection 및 공개 state의 SHA-256을 연결한다. 상세 inputRef별 원본 row key·batchId·source/license/asOf 매핑도 보존한다. raw 업로드 및 batches는 공개 snapshot에 넣지 않는다.
- 모든 생성과 권리 재검사는 기존 mkdir lock 안에서 수행한다. projection 생성 실패·쓰기 실패는 기존 state를 유지한다. fsync 후 단 한 번의 state rename으로 공개 원본·집계·기세·fixture·홈을 전환한다. 부분 projection은 활성화하지 않는다. stale lock 자동 탈취 없음.
- 정정은 새 revision/releaseId를 만든다. 롤백도 이전 records로 새 revision과 projection을 만들고, 이전 불변 릴리스들은 유지한다. 기존 momentum snapshot ID와 이전 게시 비교 이력은 보존한다. 같은 내용의 재업로드는 기존 릴리스를 유지한다.
- Proxy는 데이터 요청 시작 시 릴리스를 선택하고 내부 요청 헤더로 전달한다. Route Handler와 서버 페이지는 AsyncLocalStorage 범위에서 그 릴리스를 한 번 로드한다. 비동기 복합 읽기 중 새 게시가 발생해도 metadata/list/home/directory가 섞이지 않는다.
- 브라우저 API는 `X-Pulse-Release`, 내부 링크·router 및 GET form은 `releaseId`를 전달한다. 보존된 이전 릴리스는 동일 내용을 제공하고, 알 수 없는 ID는 503이다. 잘못된 형식·중복 또는 헤더/쿼리 불일치는 400이다. 최신 릴리스로 조용히 대체하지 않는다. 정보·법적 고지 페이지도 링크의 ID를 유지하되 점검 중 접근 가능성을 보존한다.
- 공개 데이터 API 성공 응답은 `X-Pulse-Release`, `X-Pulse-Revision`, `X-Pulse-As-Of`, 최종 JSON bytes의 SHA-256 ETag 및 `Cache-Control: no-store`를 제공한다. 기존 metadata에 revision을 선택적으로 추가했다. 304 최적화는 도입하지 않았다. ready/health는 데이터 DTO가 아닌 운영 상태다.
- 고정 DEMO 권리·출처 검사는 캐시 전에 유지한다. DATA_MODE의 REAL 전환, 공급자 연동 및 관리 API의 기존 권한/Origin/배포 읽기 전용/요청 한도 보호는 유지한다.

통합 게시 지원 범위는 **2026 정규시즌 자체 제작 DEMO**다. 다른 시즌·대회와 상세 필드가 불완전한 파일은 422로 게시 거부한다. r/rbi를 선택적 입력 필드로 확장하고, 다운로드용 자체 제작 정상·정정 샘플에 명시적인 상세 counts를 추가했다. 누락된 관측 값을 0으로 채워 게시하지 않는다. 예전 다운로드 파일은 새 템플릿을 받아야 한다. 독립 createPipeline의 일반 검증 계약은 유지하고 실제 singleton에만 통합 게시를 활성화했다.

선수 탐색 응답에 선택적 teams 메타데이터를 추가해 게시된 DEMO 팀을 필터/표시에 사용한다. 기존 sample_N 팀과 공개 API 형식은 유지한다. 등록 상태는 기존처럼 미확인이며 로스터 등록 여부를 출전만으로 추정하지 않는다. 경기 이벤트·휴식·부상 사유는 파일 계약에서 제공하지 않으므로 합성 시뮬레이션의 이력을 끌어오지 않는다.

## 자동 검증 범위

새 release-projection 통합 테스트는 정상 게시·타자/투수 상세·홈 12개·탐색/비교·원천 추적·정정·롤백·과거 릴리스·게시 중 요청 고정·알 수 없는 ID·손상 projection·필드 누락 및 rename 실패/재시도를 확인한다. 기존 미연결 게시 503 단위/API 테스트와 권한·경쟁·commit-fault 테스트를 유지한다.

관리자 E2E는 게시·정정·롤백마다 공개 API 11개에서 동일 releaseId/revision/asOf/no-store/ETag를 확인하고, 홈·탐색·타자/투수 상세·비교·랭킹 화면을 연다. 과거 게시 응답이 변경되지 않는지, 롤백 후 열린 페이지의 기간 변경 API도 원래 릴리스를 요청하는지 확인한다.

## 시각 검토

최초 macOS 실행에서 4폭×2테마의 홈 첫 비교 8개가 모두 실패했다. 기존 320px light 4703px → 현재 4992px. 기존/현재 이미지 전체를 폭·테마별로 대조했다. 의도된 기세 설명 변경: 상승세 대신 최근 출전 기세, 표본의 출전/등판 단위, 변화량 N/A, 0–100점 해석 안내, 산식 링크 문구다. 카드 추가 문장과 줄바꿈이 높이 증가를 설명한다. 잘림·가로 넘침·카드 중첩을 기준선 갱신으로 덮지 않는다.

기존 캡처에 Next 개발 표시기가 포함된 점도 확인했다. 제품 밖의 개발 UI는 screenshot style로 숨기고 production 후보 이미지를 별도 복사본에 생성해 검토한다. soft screenshot assertion은 한 화면 실패 뒤에도 나머지 경로를 모두 비교하기 위한 것으로, 실패 판정·허용 오차는 유지한다. Linux는 기존처럼 픽셀 기준선 비교 없이 접근성·동작·캡처를 검증한다.

## 실행 결과

최종 결과는 아래에 기록한다. 중간 실패는 최종 통과로 간주하지 않는다.

- 최초 로컬 관리자 E2E: 2 통과 / 1 실패, 원 CI와 동일한 aggregates TypeError.
- 최초 macOS 시각 재현: 8 실패. 기준선 임의 갱신 없음.
- 통합 과정에서 탐색 router 객체 변경에 의한 반복 요청을 공개 E2E로 발견해 useMemo로 안정화했다. 요청 한도 보호는 제거하지 않았다. 홈 탐색 URL assertion은 새 releaseId의 `?`를 정규식으로 오해하지 않도록 실제 URL과 정확히 비교한다.
- `pnpm test:migrations`: TEST_DATABASE_URL 미설정으로 SQL 실행 전 종료(exit 1). 로컬 SQL 적용 통과로 보고하지 않는다. 기존 CI #5에서는 2개 마이그레이션 적용 성공, 새 커밋의 Actions에서 재확인한다.

## 화면 확인·수동 게이트

원본 `.demo`를 초기화하지 않는다. 별도 복사본에서 `pnpm db:seed`, `pnpm build`, `pnpm start --port 3199` 후 `/`, `/players`, `/players/demo_0_00`, `/compare?players=demo_0_00,demo_0_03`, `/rankings`를 확인한다. 관리자 자동 검증은 `pnpm test:ingest:e2e`가 임시 권한과 pipeline-e2e를 사용한다. 실제 운영 토큰·비밀은 입력/업로드하지 않는다.

수동 검수 잔여: 모바일 실기기·스크린리더·실제 운영 보안/권리 감사, 원래 A01/C01 번호별 명세/수락 기준 확인, 운영 공개 승인. 실데이터·공급 계약은 DATA_PROVIDER_DECISION의 미승인 상태다. 이번 통합 게시가 REAL이나 운영 배포를 승인하지 않는다. 대규모 반복 게시의 archive 보존/정리 정책과 단일 파일 크기 한계는 별도 운영 설계가 필요하다. 자동 lock 복구나 외부 인프라를 추가하지 않았다.

다음 단계는 PR diff·아래 CI 증거와 수동 게이트 검토다. Draft 유지, main 자동 병합 없음.

시각 검토에서 탐색 fieldset은 [PLAYERS_VALIDATION](PLAYERS_VALIDATION.md)의 기존 채택 내용, 비교 후보 150→15명은 R16의 기존 기능임을 소스와 대조했다. 이 둘을 레이아웃 오류로 되돌리지 않았다. 상세의 기준시각·비교 기준·달력 공백/이동 창 설명과 랭킹의 기세 해석 안내도 기존 Phase 2 설명 변경이다. 실제 정렬 스크롤 회귀는 결과 갱신 직전 위치를 저장하고 결과 commit의 layout effect에서 복원해 수정했다. 고정 기준선에 맞추기 위한 허용 오차 확대는 없다. 랭킹 시각 경로는 `date=2026-11-03`으로 고정해 실행일에 따라 화면이 바뀌지 않게 했다.

초기 production 후보 실행은 55 통과 / 2 실패였다. 한 건은 같은 복사본의 공개·관리자 Playwright를 동시에 실행해 산출물 디렉터리가 충돌한 ENOENT였고 최종 실행은 순차 진행한다. 다른 한 건은 위 스크롤 회귀였으며 기대값 4px 미만을 유지했다. 후보 생성(`--update-snapshots`)은 픽셀 회귀 통과의 증거로 사용하지 않고, 별도 비갱신 비교로 확인한다.

추가 경계: 공개 scope의 운영 정보도 선택한 릴리스 시점에 고정된다. 최신 staging/검증 이력은 관리자 status에서 확인한다. 입력 파일 게시는 인물 수와 출처가 다른 고정 합성 데모와 구분하며 탐색의 인원/팀/필수 필드 안내도 게시된 projection을 따른다.

## 최종 로컬 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm lint` | exit 0, 경고 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test:core` | exit 0, 31파일 / 275 passed / 1 skipped. 핵심 5파일 named-function coverage 각각 100% (line/branch coverage 아님) |
| `pnpm build` | exit 0, production build·TypeScript·페이지 생성 통과 |
| `CI=1 VERIFY_PRODUCTION=1 PLAYWRIGHT_PORT=3199 pnpm test:e2e` | 격리 복사본, exit 0, Chromium **57/57 통과, 2.9분**. 갱신 옵션 없이 macOS 8개 시나리오의 40 PNG 픽셀 비교·접근성·반응형 포함 |
| `pnpm exec prettier --check` (수정 문서와 시각 manifest 명시) | 통과 |
| `git diff --check` | 통과 |

최종 소스의 성능 fixture(`synthetic_performance_v1`) 식별자도 보존하는 별도 통합 테스트를 추가했다. 시각 검토 대상 40장의 이전/신규 크기·SHA-256·갱신 사유는 [시각 검토 manifest](qa/pr1-visual-review.json)에 기록했다. 사용자/실기기 승인을 받았다는 의미가 아니다.

코드 변경: `src/server/repositories/{publication,release-projection,page-publication}.ts`, `src/server/ingest/{pipeline,files}.ts`, `src/server/db/demo.ts`, 공개 API와 read adapter, `src/proxy.ts`, 루트 layout과 `components/release-provider.tsx` 및 관련 화면. 계약/fixture/테스트·102개 반영 파일(40 PNG 포함)을 함께 검토했다. `next-env.d.ts` 자동 생성 변경은 커밋에서 제외한다. 수정 대상 텍스트의 대표 private-key/GitHub-token/AWS-key 패턴 및 금지 경로 검사에서 발견 0건이며, 완전한 전문 보안 감사로 간주하지 않는다.

원본 `.demo` 초기화, 실제 데이터 수집, 신규 패키지 설치, 유료 서비스 생성, 비밀 업로드, main 병합은 수행하지 않았다. 초기 임시 복사본의 pnpm 자동 의존성 확인 시도는 symlink hoist 오류로 실패했고 설치 성공은 없었다. 이후 임시 복사본에만 `verifyDepsBeforeRun: false`를 설정해 기존 node_modules를 사용했다. 저장소 package/lockfile 변경 없음. GitHub Actions 결과는 커밋·push 이후 PR 본문과 최종 보고에서 확인한다.

- 최종 순차 관리자 검증 `CI=1 pnpm test:ingest:e2e` (동일 격리 복사본): **3/3 통과, 34.6초, exit 0**. 성공 HTTP·공개 API 11개·타자/투수 화면·정정(안타 2→3)·중복 방지·롤백(3→2)·이전 릴리스 및 열린 페이지의 릴리스 유지 확인. 로컬 최종 수락 검사에 남은 실패 없음. PostgreSQL 실행은 위 환경 미설정 제한을 유지한다.
