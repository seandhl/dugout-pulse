# MomentumSnapshot 구현 검증 (2026-11-03)

## 수행 작업과 변경 경계

- `src/server/reads/momentum.ts`: DEMO 입력 어댑터, 역할별 4개 창, SHA-256 ID, append-only 이력과 현재 포인터, 직전 유효 snapshot delta, 랭킹 분리 정책.
- `src/server/ingest/pipeline.ts`: 기존 게시 transaction에 snapshot/현재 포인터 갱신 포함, 반복 업로드 provenance 보존, 명시적 내부 재계산과 공개 출처 검증 읽기 제공.
- `src/server/ingest/files.ts`: 타격 feature 및 투구 BF/BB/IBB 정의 선택 필드와 사건 합계 검증. 기존 파일 호환.
- `src/stats/momentum.ts`: 선택 창 지원. 생략 시 기존 v0.1 골든 결과 유지.
- `src/contracts/momentum.ts`, `src/app/api/v1/players/[id]/momentum/route.ts`, `src/app/api/v1/rankings/route.ts`: 입력/응답 스키마, 역할 필수, 기본 창, 정렬, 오류 처리.
- `tests/unit/momentum-snapshots.test.ts`: cohort fixture 게시부터 정정, 재시작, 이력 보존, 재계산/재업로드 idempotence, 더블헤더, 모델 버전 격리, 역할 분리, 입력 순서 안정성 및 Route Handler 검증.
- DECISIONS/SCHEMA/API_CONTRACT/ASSUMPTIONS/MOMENTUM_MODEL에 버전·마이그레이션·정책 기록.

## 실행 결과

- `./node_modules/.bin/vitest run`: 12개 파일, 179개 테스트 통과. 기존 pipeline의 게시 commit 실패 rollback 검증도 포함한다.
- `./node_modules/.bin/eslint . --max-warnings=0`: 통과.
- 변경 TypeScript 파일 `prettier --check`: 통과.
- `./node_modules/.bin/tsc --noEmit`: 실패. 기존 `prisma.config.ts:1`의 `prisma/config` 모듈/타입 누락. 이번 변경 파일의 추가 타입 오류는 출력되지 않았다. 전체 타입 검사 통과로 간주하지 않는다.
- `./node_modules/.bin/next build --webpack`: 코드 컴파일 성공, 동일 Prisma 의존성 누락으로 타입 검사 단계 실패. 최종 production build 성공으로 간주하지 않는다.
- 패키지 설치·외부 수집·커밋·푸시는 수행하지 않았다.

## 확인 방법과 제한

`npm run dev` 후 `/api/v1/players/demo_player_1/momentum?role=hitter&window=10&season=2026` 및 `/api/v1/rankings?role=hitter&window=10&sort=change&season=2026` JSON을 확인한다. 이 작업은 화면 UI를 변경하지 않았으며 실제 브라우저/HTTP 서버 검증은 미실행이다. Route Handler 자체는 테스트에서 실행했다.

기본 ingest 예시는 표본·feature가 부족하여 score=null/excluded가 정상이다. 실제 점수 정정의 수락 기준은 테스트에서 자체 cohort를 실제 파일 pipeline에 게시하고 한 경기 기록을 수정하여 검증했다. 기존 파일 저장소의 스냅샷 초기화는 다음 변경 게시, 기존 배치 재게시 또는 내부 `recalculateMomentum()` 호출에서 수행한다. 실제 운영 DB/Prisma 저장 연동·마이그레이션 실행은 포함하지 않는다.

다음 단계 준비: API와 additive 파일 마이그레이션 경계가 문서화되었다. UI 연결과 실제 DB 전환은 별도 단계이며, 먼저 현재 Prisma 의존성 누락을 해결해야 전체 타입 검사와 production build를 완료할 수 있다.
