# 공급자 독립 ingest 계약 v1

현재 운영은 DEMO 전용이다. 외부 수집, KBO 내부 요청 분석, 크롤러, 네트워크 transport는 없다.
LICENSED_API는 생성할 수 있지만 listAvailableSeasons/parseBatch/ingest와 공개 gate에서
`NOT_CONFIGURED` 오류로 중단한다. 환경변수나 파일의 승인 플래그로 활성화할 수 없다.
실제 인증과 엔드포인트별 계약 범위가 확인된 후 별도 구현·검수·ADR이 필요하다.

## 새 공급자 연결 절차

1. 공급자와 파일/API 사용 권한을 확인하고 서버 관리 registry에 DataSource와 License를 등록한다.
   업로드 파일에서 받은 권리 기록은 registry에 자동 등록하지 않는다. 비밀 대신 evidenceRef/reviewRef를 저장한다.
2. `src/server/ingest/contracts.ts`의 DataProvider를 구현한다. describeSource는 출처를 반환하고,
   listAvailableSeasons는 허용된 시즌만 반환한다. fetchGames/fetchPlayers/fetchRoster는 선택 기능이며
   구현하지 않은 기능은 생략한다. 현재 canonical JSON adapter는 원격 조회와 시즌 catalog가 없어 빈 배열을 반환한다.
3. 공급자 형식을 canonical batch로 변환하고 `ingest(provider, input, registry)`를 호출한다.
   공통 경계는 mock/custom provider의 반환값에도 입력 검증·권리 검사를 다시 수행한다.
   원천이 없는 필드나 sampleSize를 추정하지 않는다. 현재 payload는 선수 및 선수 통계만 지원한다.
   경기/로스터 canonical payload 확장은 별도 스키마 버전·변환·테스트가 필요하다.
4. 결과는 검증된 수입 배치일 뿐 공개 승인이 아니다. 별도 staging 저장과 검수 후
   `publishGate(batch, registry)`를 호출한다. 공개 읽기에서도 현재 registry를 읽고 다시 검사한다.
   호출 실패 시 게시/응답을 중단하며 이전 허가 결과를 캐시하지 않는다.
5. 향후 DB에서는 같은 transaction에서 release 포인터·불변 배치·현재 권리 조회와 공개 projection을 수행한다.
   현재 DB wrapper는 게시 context가 없으면 전부 거부하며 LICENSED_FILE/API 공개도 거부한다.
   현재 실제 API는 canonical generator와 완전히 일치하는 DEMO SQLite만 읽는다.
   실제 데이터 DTO·영속 staging·게시 트랜잭션·관리자 인증 연결은 이번 어댑터의 구현 범위가 아니다.
6. mock, 누락/만료/철회/범위 초과, 파일 자기 승인, namespace 혼합, 권리 변경 이후 재공개 거부 테스트를 통과시킨다.

## 필수 권리 필드

DataSource: sourceId, publicName, mode(DEMO/LICENSED_FILE/LICENSED_API), status,
allowedUses, validUntil, displayAllowed, transformAllowed.

License: licenseId, sourceId, mode, status, evidenceRef, reviewRef, attribution,
validFrom, validUntil, allowedUses, displayAllowed, transformAllowed,
allowedSeasons, allowedCompetitions, allowedFields.

두 기록 모두 APPROVED여야 한다. 미기재·유효하지 않은 날짜·유효기간 종료 시각부터 거부한다.
수입은 collect/store/transform 및 transformAllowed, 공개는 추가로 display 및 displayAllowed가 필요하다.
allowedFields는 payload의 필드명이며 통계는 `stats`와 `stats.h`처럼 개별 필드까지 허용해야 한다.
DEMO에도 같은 검사를 적용하고 mode/namespace를 변경하여 실제 데이터로 승격할 수 없다.

기존 PostgreSQL DataLicense의 collection/storage/derivation/publication은 각각
collect/store/transform/display로 명시적으로 매핑해야 한다. expires_at=null을 무기한 승인으로
추정하지 않는다. 이 계약은 서버 ingest DTO 추가이며 기존 DB/API 스키마 변경은 없다.
현재 PostgreSQL registry adapter는 미구현이다.

## Canonical 파일 예시

아래는 테스트용 가상 예시다. LICENSED_FILE 표기는 실제 허가를 의미하지 않는다.
서버 registry에 일치하는 승인·증빙·필드 범위가 없으면 거부된다.

```json
{
  "schemaVersion": "1.0.0",
  "batchId": "mock-batch-1",
  "sourceId": "mock-source",
  "licenseId": "mock-license-1",
  "mode": "LICENSED_FILE",
  "namespace": "licensed",
  "season": 2026,
  "competition": "regular",
  "asOf": "2026-01-01T00:00:00Z",
  "importedAt": "2026-01-02T00:00:00Z",
  "adapterVersion": "mock-1",
  "players": [{
    "playerId": "mock-player-1",
    "displayName": "가상 선수",
    "listedRoles": ["batter"],
    "sourceId": "mock-source",
    "sampleSize": 0
  }]
}
```

동일 sourceId/licenseId/mode와 시즌·대회 허가가 필요하다. DEMO는 mode=DEMO,
namespace=demo를 사용한다. 입력 한도는 5MiB/50,000 선수이며 중복 playerId를 거부한다.
현재 파일 parser는 JSON 문자열 또는 검증할 객체를 받으며 파일 시스템 경로·URL을 열지 않는다.
asOf와 importedAt은 미래 시각을 거부한다. 원본 ID, sourceId, licenseId, adapterVersion,
asOf, 시즌·대회·sampleSize를 유지한다. 원본 해시/배치 영속화는 기존 DB 수입 단계에서 연결해야 한다.

검증: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
화면: 기존 DEMO 화면 및 `/api/v1/players`만 유지된다. 업로드/공급자 관리 UI는 없다.

## 이번 검증 결과 (2026-11-03)

- `pnpm test`: 4개 파일, 18개 테스트 통과. 공급자/권리 gate와 기존 회귀 테스트 포함.
- `pnpm lint`: 통과. 변경 코드/가이드 Prettier 검사 통과.
- `pnpm typecheck`: 실패. 기존 prisma.config.ts의 `prisma/config` 의존성이 설치되지 않음(TS2307).
- `/private/tmp/dugout-ingest-tsconfig.json`으로 src와 단위 테스트에 기존 strict 설정을 적용한
  `pnpm exec tsc --project /private/tmp/dugout-ingest-tsconfig.json --noEmit`: 통과.
  전체 프로젝트 타입 검사 통과를 의미하지 않는다.
- UI 변경이 없으므로 브라우저/E2E·DB 통합 검사는 실행하지 않았다. 실제 공급자 연동은 검증하지 않았다.
