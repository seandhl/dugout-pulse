# 1군 범위·freshness 검증 (2026-11-03 KST)

## 수행 작업

날짜별 1군 스냅샷·효력일·소속팀 이력과 선수/코치를 분리했다.
유효한 최신 스냅샷이 없으면 등록 검색은 빈 결과와 ‘엔트리 정보 없음’을 표시한다.
출전 검색은 독립적으로 확정 경기 로그를 사용한다. 마지막 출전일·표본·데이터 시점을 표시한다.
시즌 선택, 정규/포스트/올스타/시범 대회 분리, 수동 import 실행 이력·실패 사유·갱신 임계값을 추가했다.
스케줄러는 비활성, 알림은 미연결이다. 기존 관리자 권한과 고정 DEMO 파일 제한은 유지했다.

## 변경 파일

- 계약/저장: `src/server/ingest/files.ts`, `pipeline.ts`, `contracts.ts`, `src/contracts/api.ts`
- 조회: `src/server/reads/scope.ts`, `src/server/repositories/demo.ts`
- API/화면: `src/app/api/v1/scope/route.ts`, `src/app/api/v1/published/route.ts`, `src/app/(public)/published/page.tsx`, `src/components/shell.tsx`
- 테스트: `tests/unit/scope.test.ts`, `tests/unit/pipeline.test.ts`, `tests/e2e/ingest.spec.ts`
- 문서: `docs/DECISIONS.md`, `docs/ASSUMPTIONS.md`, `docs/API_CONTRACT.md`, 이 문서

## 실행 결과

- `npm test`: 9개 파일, 82개 테스트 통과. KST 자정·윤년·잘못된 날짜·스냅샷 효력일·유효기간·UNKNOWN·오래된 정정·출전/등록 검색·대회·코치 분리·freshness 임계 경계를 검증했다.
- `npm run lint`: 통과.
- 변경 파일 `prettier --check`: 통과.
- `npm run test:ingest:e2e`: Chromium 3개 통과. 로컬 포트 EPERM 때문에 최초 실행 실패 후 샌드박스 밖에서 재실행했다. 관리자 모바일 접근성·게시 승인·정정 반영·날짜별 화면·날짜 API를 확인했다.
- `npm run typecheck`: 실패. 기존 `prisma.config.ts`에서 설치되어 있지 않은 `prisma/config`를 찾지 못한다. 패키지는 설치하지 않았다.
- `tsc --project /tmp/dugout-scope-tsconfig.json --noEmit`: 통과. 기존 tsconfig를 확장하고 src 전체·tests 전체·next-env.d.ts로 include를 한정한 별도 검사다. 전체 프로젝트 타입 검사 통과를 의미하지 않는다.

## 화면 확인

`npm run dev` 후 `/published?season=2026&competition=regular&date=2026-10-31&search=appeared`.
상단 ‘1군·데이터 시점’ 메뉴에서도 진입한다. 관리자 화면에서 순서대로 players → games → rosters → batting_game_logs 샘플을 검증·명시적 게시한다.
등록 검색과 출전 검색을 전환하고, 날짜를 2026-11-03으로 바꾸면 기본 샘플의 등록 정보가 만료되어 ‘엔트리 정보 없음’이 표시된다.
빈 저장소에서는 빈 결과와 기준시각 없음이 표시된다. API 예시는 API_CONTRACT.md 참조.

## 제한과 다음 단계

실데이터·외부 수집·자동 스케줄·알림 전송은 없다. 로컬 DEMO 파일 저장소이며 현재 승인된 시즌은 2026이다.
날짜 필터는 최신 정정본의 경기 귀속일/스냅샷 날짜 기준이며 당시 알려진 기록을 완전 복원하지 않는다.
명단 완전성은 추정하지 않는다. 인증/파싱 이전 오류와 저장소 자체 실패는 run 이력 밖에서 HTTP 오류로 보고한다.
후속 라이선스 공급자 계약에서 명단 완전성·유효기간·시즌/대회 범위·freshness SLA를 확정한 뒤 adapter와 스케줄 연결을 검토한다.
운영 DB 이관 및 Prisma 모듈 누락 해소는 후속 작업이다. 커밋·푸시는 수행하지 않았다.
