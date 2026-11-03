# R10 게시 릴리스 경계

2026-11-03. 기준 커밋 `6f72cd0`, 작업 브랜치 `codex/r10-atomic-release`.
기존 R06/R07/R09 미커밋 변경을 포함한 작업 트리를 기준으로 조사했다.
Git 루트는 현재 프로젝트 자체이며 AGENTS의 홈 루트 설명은 현 상태와 다르다.

## 현재 읽기 경로

| 공개 API / 페이지 | 실제 저장소·adapter | releaseId / revision |
| --- | --- | --- |
| `/api/v1/meta`, `/api/v1/players`, `/api/v1/players/[id]` | demoRepository → readDemo → SQLite demo_release | fixture.releaseId (`synthetic_v2`), 게임별 revision |
| `/api/v1/home`, `/` | readHome → SQLite demo_home_snapshot + 검증된 demo_release hash | fixture.releaseId + release_hash, role/window |
| `/api/v1/player-directory`, `/players` | readDirectory → readDemo + readHome | 동일 canonical fixture / 게임 revision |
| `/api/v1/players/[id]/batting`, `/api/v1/players/[id]/pitching` | readDemo → 역할별 detail selector | canonical fixture / 게임 revision |
| `/players/[id]` 일반 상세 | readDemo + playersService, 클라이언트 detail API | canonical fixture / 게임 revision |
| `/compare` | readDemo → selectComparison | canonical fixture / 게임 revision |
| `/api/v1/rankings`, `/rankings` | pipeline.readPublicState → momentumView / selectRankingBoards | state.revision, snapshot.publicationRevision; 계산 입력 releaseId는 published-demo |
| `/api/v1/players/[id]/momentum`, `/players/[id]?snapshot=…` | pipeline.readPublicState | state.revision + snapshot ID / publicationRevision |
| `/api/v1/published`, `/api/v1/scope`, `/published` | pipeline.publicResults / scope → state.json | state.revision; canonical release와 연결 없음 |
| `/api/ready` | readDemo | canonical 사용 가능 여부, 릴리스 DTO 없음 |
| `/api/health` | 프로세스 상태 | 데이터 릴리스 없음 |
| `/about`, `/data-terms`, `/privacy`, `/legal`, `/design-preview` | 정적 설명·디자인 | 통계 릴리스 없음 |
| `/sitemap.xml`, `/robots.txt` | 정적 경로·검색 정책 | 통계 릴리스 없음 |

관리자 API는 공개 데이터 API가 아니며 원본 staging/audit를 계속 조회한다.

## ADR-R10: 공통 게시 릴리스

상태: **차단 경계 채택·구현 / 통합 릴리스 전환 설계 제안**. R10 전체 수락은 미충족이다.

현재 두 저장소에 완전한 공통 projection이 없다. 파일 게시 성공을 서비스 전체 게시 성공으로 취급하지 않는다.
이번 변경은 `repositories/publication.ts`에서 파일 게시 revision이 0이 아니거나 기록이 있으면 모든 canonical 및 파일 공개 읽기를 503 STALE_DATA로 차단한다.
검증 실패·staging만으로는 차단하지 않는다. rollback은 revision이 증가하므로 통합 연결 전에는 계속 차단한다.
손상 파일·권한 오류·미지원 버전도 차단하며 관리자 이력은 보존한다. 독립 createPipeline은 기존 동작을 유지하고 운영 singleton에 공통 guard를 주입한다.
이것은 혼합 노출을 막는 중간 안전 단계이며 **게시 후 데모 조회가 차단되는 제한**이 있다. 정상 게시 후 전 화면 표시 보존이라는 최종 목표의 대체물이 아니다.

제안하는 최소 완성 설계:

1. 파일 저장소 하나에 불변 `releases/<releaseId>.json`을 보관한다. manifest에는 schemaVersion, releaseId, revision, DEMO/REAL, season, competition, asOf, modelVersion, sourceIds, licenseIds와 권리 registry version/hash, 원천 참조, 각 projection hash를 포함한다.
2. release는 홈·선수 목록·역할별 상세·비교·랭킹 projection을 모두 갖춘 후에만 완전하다고 판정한다. 없는 역할은 명시적 빈 배열이며 다른 release에서 채우지 않는다. 기존 SQLite fixture는 첫 불변 release를 만드는 adapter로 유지한다. Neon/Prisma는 필요하지 않다.
3. 기존 mkdir lock 안에서 검증·권리 재검사·projection 생성·fsync 후 active pointer를 단 한 번 rename한다. 계산/쓰기 실패는 이전 pointer를 유지한다. 정정은 새 release, rollback도 이전 불변 내용에 새 publication revision을 발급한다. stale lock 자동 탈취는 하지 않는다.
4. 요청 시작 시 pointer를 한 번 읽어 ReleaseRepository 인스턴스에 고정한다. 선수 metadata/list와 directory/home 복합 읽기도 같은 인스턴스를 전달한다. scope는 이번 수정처럼 상태를 한 번 읽고 records와 운영 상태를 함께 산출한다.
5. 브라우저의 후속 API·페이지 이동은 releaseId를 전파한다. 보존된 불변 release가 없으면 409/503 stale 또는 빈 상태로 응답하고 최신 release로 조용히 대체하지 않는다. 실제 데이터 모드는 별도 권리 승인 없이는 계속 거부한다.
6. 캐시 키는 releaseId/revision/season/competition/modelVersion/source registry hash/권리 version/query 전체를 포함한다. 권리 확인은 캐시 전에 수행한다. 현재 API는 no-store이며 이번 guard 역시 캐시 전에 실행한다. ETag는 최종 DTO bytes의 hash, asOf는 manifest 값으로 제공한다. 304 전에도 권리·릴리스 유효성을 확인한다. 현재 ETag/공통 asOf 계약 추가는 미구현이다.
7. 공개 DTO에 release identity를 추가하는 additive schema migration과 계약 테스트를 먼저 적용하고, adapter를 경로별 교체한다. 전환 중 일부 경로만 새 릴리스를 제공하지 않는다. projection 완료·전 경로 검증 전에는 guard를 해제하지 않는다.

## 검증과 다음 진입 조건

`tests/unit/publication.test.ts`는 실제 임시 파일 pipeline의 검증 실패·게시 성공·정정·rollback 후 공통 차단 및 손상 파일 차단을 확인한다. 기존 pipeline commit-fault/경쟁 테스트를 함께 실행한다. 완성된 공통 릴리스로 전 화면 정상 표시되는 통합 테스트는 아직 없다.

R10 종료 조건: 모든 projection adapter와 요청 고정, 공개 releaseId/revision/asOf/ETag 계약, 브라우저 release 전달, 정상·실패·정정·rollback·동시 요청의 전 화면 통합 및 E2E를 구현하고 회귀 검증해야 한다.

되돌리기: 이번 guard import/호출과 singleton 주입을 제거하고 scope의 단일 읽기 개선은 유지할 수 있다. 데이터·SQLite·게시 파일은 변경하거나 삭제하지 않았다. 되돌리면 기존 혼합 노출 위험이 복원된다. 기존 미커밋 변경 때문에 파일 전체 git restore는 사용하지 않는다.

### 이번 실행 기록

| 명령 | 실제 결과 |
| --- | --- |
| `pnpm test` | 28파일, 267 통과 / 1 skip (선택 성능 검사). 임시 파일 통합 및 공개 API 11개 차단 검증 포함 |
| `pnpm test:e2e` | 최초 서버 listen EPERM, 실행 불가. 허용 환경 재실행 `CI=1 pnpm test:e2e`: Chromium 35 통과, 3.5분. 기본 canonical 데모 회귀이며 게시 전환 E2E 아님 |
| `pnpm typecheck` | 통과. 새 테스트 입력 필드와 필수 role 누락을 수정한 후 재검증 |
| `pnpm lint` | 통과, 경고 허용 0 |
| `pnpm build` | 통과 exit 0. E2E 종료 뒤 최종 소스로 재실행, 22개 정적 페이지 생성 |
| `git diff --check` | 통과 |

로그: `reports/r10/`. E2E 개발 서버에 stream errored 로그 1건이 있어 서버 무오류로 주장하지 않는다. 외부 데이터·설치·계정·배포·push·커밋은 수행하지 않았다.

화면 확인: `pnpm dev` 후 `/`, `/players`, `/players/demo_0_00`, `/compare?players=demo_0_00,demo_0_01`, `/rankings`를 조회한다. 연결되지 않은 기존 파일 게시가 있으면 공개 조회가 차단되는 것이 현재 설계다. 기존 파일을 삭제해서 해제하지 않는다. 차단 시 API 503/no-store 및 한국어 오류 메시지를 확인할 수 있다. 실제 게시/정정/rollback 조작은 테스트의 임시 저장소에서만 수행했다.
