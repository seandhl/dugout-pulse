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
