# /rankings 검증

2026-11-03 · DEMO 전용.

변경: 입력 계약, 게시 snapshot 서버 조회/표본 게이트/정렬/20명 pagination, 타자·선발·불펜 보드, URL 필터와 정렬 링크, 역할 지표 설명, 공식 링크, 원천·기준·계산 시각, snapshot 선수 상세 및 오류 재시도 화면.

검증 명령:
- `pnpm test -- tests/unit/ranking-boards.test.ts tests/unit/momentum-snapshots.test.ts`: 17 files / 202 tests 통과(현재 스크립트가 전체 unit suite 실행).
- `pnpm exec vitest run tests/unit/ranking-boards.test.ts`: 5 tests 통과.
- `pnpm lint`: 통과.
- `pnpm typecheck`: 실패. 기존 `prisma.config.ts`의 `prisma/config` 모듈 미설치. 패키지 설치 금지 준수.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/rankings.spec.ts`: Chromium 2 tests 통과. 초기 실행은 sandbox Chromium 권한 및 3111 서버 연결 실패. 기존 3100 서버에서 재실행 성공. 미갱신/잘못된 조건/URL 탭·필터/390px overflow 확인. populated snapshot 브라우저 검증은 미실행(게시 fixture 별도 설정 필요).

확인: `pnpm dev` 후 `/rankings`. `?date=1900-01-01`은 기록 미갱신, `?window=7`은 잘못된 조건 안내. 실제 게시 파일이 없으면 세 보드는 비어 있는 것이 정상이다. 가상 순위를 자동 생성하지 않는다. 게시 snapshot이 있으면 링크가 해당 immutable snapshot 상세로 이동한다.

제한: 운영 DB adapter 미연결로 SQL ORDER BY 검증은 불가. 페이지는 저장된 JSON 게시 snapshot을 서버에서 정렬한다. 과거 전체 manifest 미보존으로 과거 가장 최근 revision만 보수적으로 표시한다. 실제 데이터/자동 수집/실시간 랭킹 없음. 운영 DB와 과거 manifest 연결이 다음 단계다.

## R05 수정 검증 · 2026-11-03

기준: `codex/fix-verify-ci` / `6f72cd0`의 깨끗한 작업 트리에서 `codex/fix-ranking-raw-ties` 생성. 실제 Git 루트는 프로젝트 디렉터리임을 확인했다(AGENTS의 홈 루트 설명은 현재 상태와 다름). 커밋·푸시·배포·패키지 설치·외부 기록 수집 없음.

변경: ADR-030 채택. 원값 정렬, 정확한 원값 동점만 공동 순위(1,1,3), ID 안정 순서, 전체 필터 결과에서 순위 부여 후 페이지 분할. 표시 반올림은 페이지 렌더링에서만 수행한다. API와 보드가 같은 조회를 사용하며 API에 decline/date/team을 추가했다. modelVersion 값과 저장 snapshot/provenance/DEMO 계약은 보존했다. API의 change는 양수 전용으로 변경되므로 음수 조회 소비자는 decline으로 전환해야 한다. DB 스키마 마이그레이션은 필요하지 않다.

실행 결과:
- `pnpm test`: 26 files, 245 passed / 1 skipped (PERFORMANCE 환경변수 전용 벤치마크).
- `pnpm exec playwright test tests/e2e/rankings.spec.ts`: Chromium 2 passed. 설명·필터/정렬 URL·빈 날짜 API·오류 상태·390px 가로 넘침 검증. 첫 시도는 sandbox listen EPERM으로 실패했고 권한 허용 후 재실행 통과.
- `pnpm typecheck`: 통과. 최초 실행은 새 테스트 fixture에 잘못 들어간 필드로 실패, 수정 후 재실행 통과.
- `pnpm lint`: 통과. 중간 실행의 테스트 미사용 변수 경고 3건을 수정하고 재실행 통과.
- `pnpm build`: 통과.
- 원값 차이/동점/페이지 경계/양·음수 미세 변화/0/null/신뢰도/표본 제외를 단위 테스트로 확인. score/change/decline 각각 동일 URL 조건의 API HTTP 응답을 계약 스키마로 파싱하고 보드의 ID·rank·score·deltaScore와 일치하는지 확인했다. 큰 DEMO 패널의 provenance 보존 비교도 새 공동 순위 규칙에 맞췄다.

화면 확인: `pnpm dev` 후 `/rankings?season=2026&competition=regular&window=10&sort=score`에서 정렬 설명을 확인한다. 게시 snapshot이 있으면 change/decline 탭과 다음 페이지를 확인한다. `date=1900-01-01`은 기록 미갱신, `window=7`은 잘못된 조건을 표시한다. 같은 조건에 role=hitter를 지정한 `/api/v1/rankings`의 원값·rank와 비교할 수 있다.

제한: 동점이 채워진 브라우저 화면 검증은 미실행이며 재현 fixture의 단위·HTTP 회귀 테스트로 검증했다. 운영 DB adapter/SQL 검증과 과거 전체 manifest 복원은 범위 밖이다. API는 범위 밖 페이지에 빈 배열, 보드는 마지막 페이지로 보정하는 기존 탐색 방식을 유지한다. 모든 데이터는 DEMO다.

되돌리기: 이 브랜치 변경을 역적용하거나 기준 브랜치로 전환한다(작업 보존 필요). 커밋 후에는 해당 커밋을 revert한다. 저장 데이터 마이그레이션은 없다. 다음 단계 조건: API 소비자의 change/decline 의미 전환 검토, 게시 fixture를 갖춘 브라우저 검수 후 R05 출시 판단. 다른 R 항목의 완료를 의미하지 않는다.
