# 성능 검증 — 결정적 대량 DEMO

검증일: 2026-11-03 KST. **외부 기록·이미지·크롤링·패키지 설치 없이 측정했다.** 실제 운영 선수 기록 또는 운영 SLA가 아니다. 공개 DEMO 조회의 아래 수치 목표는 충족했다. PostgreSQL 운영 연동과 현장 Web Vitals 검증은 완료 범위가 아니다.

## 환경과 재현 데이터

- Node v26.11.0, Apple M1 Pro, Next 16.4.4 webpack, 로컬 macOS Chromium, 네트워크/CPU throttling 없음.
- `generatePerformance()`는 고정 seed 20261103의 자체 저작 패널을 4개 독립 선수군·6개 과거 날짜 구간으로 확장한다. 600명, 3,144경기, 68,640개 경기 로그. ID는 고유하고 원천 fixture는 결정적이다. 선수 전체 API는 600명, appeared 디렉터리는 출전이 있는 524명이다. 결장/무출전 선수를 출전 선수로 만들지 않는다.
- 정규시즌 2026, as-of `2026-11-03T00:00:00.000Z`, source/release `synthetic_performance_v1`, 자체 저작 DEMO 권리. fixture JSON 23,471,546 bytes, SHA-256 `f29f61c76a1c6fb0741dabb9c6d3076b6ffad1d02cf4988077be32b4faa5c874`.
- fixture는 이미지·로고를 참조하지 않는다. 브라우저는 모든 image 요청을 abort했다. 원천 lineage, 기간, 역할, 표본, 미산출 상태를 유지한다. 패널은 모델 정확도/예측력 검증용이 아니다. 결장/이적 이벤트 목록 자체는 스트레스 fixture에서 비우며 해당 의미론은 기존 fixture 테스트로 검증한다.
- 원시 결과: `reports/performance.json`, `reports/performance-browser-compile.json`, `reports/performance-concurrency.json`, `reports/seed-performance.json`. 최초/이후 실험 간 부하가 다르므로 이 문서는 마지막 저장 결과를 사용한다.

## 목표와 개선 전후

동일 프로세스에서 워밍업 후 각각 측정했다. p95는 정렬한 관측값의 nearest-rank이며 작은 표본의 최댓값일 수 있다. 비교 구현은 수정 전 selector를 `tests/performance/baseline-*.ts`에 보존했다. 출력 동등성도 검사한다. 검색 수치는 점수 계산을 제외한 selector이며 실제 HTTP는 별도로 측정했다.

| 측정 | 목표 | 개선 전 | 개선 후 | 표본/판정 |
|---|---|---:|---:|---|
| 디렉터리 selector p95 | <50ms | 562.43ms | 0.46ms | 각 15회, 통과 |
| 디렉터리 selector median | 비교 | 533.12ms | 0.43ms | 각 15회 |
| 집계 없는 첫 selector | <100ms | 별도 미측정 | 26.84ms | 1회, 통과 |
| 랭킹 selector p95 | <250ms | 4,092.42ms | 30.04ms | 전 5회/후 15회, 통과 |
| 랭킹 selector median | 비교 | 4,052.94ms | 28.92ms | 동일 패널 |
| 실제 검색 HTTP p95 | <200ms warm | 미측정 | 4.19ms | 30회, 통과 |
| 새 프로세스 첫 검색 HTTP | <1,000ms cold | 브라우저 navigation 30초 timeout 재현* | 503.21ms | 1회, 통과 |
| 오프라인 배치 실행 중 HTTP p95 | <200ms | 동시 실행 미측정 | 10.92ms | 216회, 통과 |
| SQLite 관계형 로그 조회 p95 | 인덱스 계획 + 지연 감소 | 4.76ms | 0.03ms | 각 100회, 통과 |

*수정 전 실제 공개 검색이 동기 기세 계산을 시작하며 `page.goto(..., waitUntil: networkidle)` 30초 timeout이 발생했다. 이는 navigation timeout 관측이며 API 단독 지연이나 성공 응답 시간으로 환산하지 않았다. 최종 cold 수치는 별도 프로세스를 시작한 후 스크립트 첫 API 요청의 body 수신까지 잰 시간이다.

## 병목과 구현

1. **선수 × 전체 로그 재순회:** 출전 로그를 선수/타격·투구별로 한 번 묶는다. 기간별 통계와 점수 결합을 fixture별 WeakMap에 저장한다. 공개 요청은 필터·정렬·최대 20행 slice만 수행한다. 검색어마다 캐시를 생성하지 않는다.
2. **랭킹 × 전체 provenance 재직렬화:** 원천 참조 인덱스를 한 번 구성하고 snapshot inputRefs만 해석한다. 과거 중복 버전의 순서와 팀/역할/모델 버전/게시 revision 선택은 기존 결과와 동등하다. 랭킹은 게시 시 생성한 momentum snapshot을 조회하며 요청에서 점수를 계산하지 않는다. 원천 참조 enrichment와 정렬은 아직 조회 시 수행하며 사전 계산한 완전한 랭킹 DTO 저장소는 아니다.
3. **공개 요청의 기세 계산:** `home-projection.ts`를 별도 seed 프로세스로 분리했다. 역할/기간 snapshot을 SQLite PK `(release_id, role, window)`로 조회한다. fixture와 12개 snapshot을 같은 트랜잭션으로 교체한다. source/as-of/release hash 불일치 또는 snapshot 없음은 503이며 요청 중 재계산하지 않는다. 기존 DB에는 seed가 snapshot 테이블과 release_hash 열을 추가한다.
4. **계산 중 중복 검증:** batch scorer가 입력을 복제·freeze하고 같은 release/cutoff의 행 검증을 재사용한다. 선수·로스터 메타데이터는 매번 검사한다. 기본 상세 trace/hash는 유지한다. 홈 projection만 사용하지 않는 input hash를 생략한다. 기존 결과·confidence와의 동등성을 검사한다. 파일 파이프라인도 scope별 로그/경기 인덱스와 검증된 scorer를 재사용한다.
5. **N+1 검사:** 공개 선수 metadata/list가 같은 검증 fixture 객체를 재사용하도록 했다. 캐시 테스트에서 동일 release 2회 읽기에 SQL SELECT 1회를 확인했다. 디렉터리 cold는 release 1회 + 역할별 snapshot 3회로 선수 수와 무관하며 warm은 SQL 없이 stat/집계 조회한다. PostgreSQL projector는 미구현이므로 ORM query log 검사는 하지 않았다.
6. **페이지네이션:** 선수 API의 서명 cursor/최대 20행 계약을 유지한다. 실제 HTTP로 600명/30페이지/중복 0을 확인했다. `/api/v1/rankings`는 page/limit(최대 20), total/excludedTotal/hasMore를 추가하고 data와 excluded 각각을 제한한다. 내부 무페이지 조회 및 선수별 momentum 계약은 유지한다. 전체 inputRefs/explanation의 바이트 크기까지 제한하는 DTO는 아직 아니다.
7. **캐시 invalidate:** SQLite inode/size/mtimeNs/ctimeNs 또는 profile이 바뀌면 검증 fixture를 교체한다. 파생 캐시는 fixture identity에 묶인다. 파일 publish/rollback 시 공개 상태 캐시를 폐기하며 외부 파일 교체도 stat으로 탐지한다. source/license registry 변경은 캐시 key에 반영하고 권리 검사는 캐시 hit 전에도 매번 실행한다. revocation·파일 교체·tampering·잠금 retry 테스트를 추가했다. 다중 호스트 cache bus는 없다.

## DB 인덱스와 EXPLAIN

실제 DEMO DB는 SQLite의 검증된 release JSON과 홈 snapshot을 읽는다. 별도 in-memory 관계형 projection에 동일 68,640개 로그를 넣고 측정했다. 이 projection을 실제 PostgreSQL 앱 쿼리나 PostgreSQL planner 결과로 표시하지 않는다.

- 전: `SCAN logs` + `USE TEMP B-TREE FOR ORDER BY`.
- 후: `SEARCH logs USING COVERING INDEX logs_player_role_game (batch=? AND player=? AND role=?)`.
- 인덱스: `(batch, player, role, game)`; player/role 필터 후 game 정렬·LIMIT. 전체 EXPLAIN QUERY PLAN은 원시 JSON에 있다. 기존 PostgreSQL 타격/투구 로그에도 같은 접두 인덱스가 있다.
- PostgreSQL 랭킹에는 배치·시즌·대회·역할·기간·모델 + value DESC/player_id ASC 인덱스를 additive migration `202611030002_public_ranking_index` 및 Prisma schema에 추가했다. `scripts/explain-public-ranking.sql`은 승인된 DEMO 배치를 지정해 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`을 실행할 준비 파일이다.
- **PostgreSQL migration/EXPLAIN 미실행:** 로컬 psql/Docker/Prisma CLI가 없으며 패키지 설치를 하지 않았다. 실제 projector·권한 조인·부분 문자열 검색 계획은 미검증이다. 이 인덱스가 PostgreSQL에서 빨라졌다는 수치는 없다. 운영 연결의 다음 수락 조건으로 남긴다.

## 브라우저·번들·로딩

최종 빌드는 `next build --webpack --experimental-build-mode compile`이다. 최적화된 JS를 `next start`로 실행했으나 전체 production build 검증을 대신하지 않는다. 별도 generate 시도는 proxy.js → middleware.js rename ENOENT로 실패했다. 전체 typecheck도 기존 Prisma 설정 의존성 부재로 실패한다.

- 이미지 차단 Chromium에서 5회 선수 목록 탐색 및 검색: LCP 28.00–156.00ms, 관측 구간 layout shift 합계 모두 0. 목표 LCP <2,500ms / shift 합계 ≤0.1 통과. 데스크톱 로컬 lab 결과이며 실제 사용자/모바일/저속망 p75가 아니다.
- 목록 확인까지 612.02–880.52ms. 여기에는 Playwright networkidle 대기의 유휴 구간이 포함된다. 이 값을 순수 렌더 시간으로 해석하지 않는다. LCP가 skeleton을 포함한 초기 화면 지표일 수 있어 목록 존재도 별도로 확인했다.
- Event Timing의 durationThreshold 16ms 이상 interaction 관측은 비어 있다. **INP는 미측정**이며 0ms 또는 통과로 보고하지 않는다. 현장 RUM/세션 기반 CLS/INP는 아직 없다.
- 첫 선수 목록 경로에서 관측한 script 리소스와 산출 chunk를 매칭한 gzip 합계 **191,942 bytes**, 원본 합계 **634,919 bytes**. gzip 목표 <250,000 bytes 통과. gzip은 산출 파일을 로컬 압축한 크기이며 실제 HTTP 전송 인코딩 크기와 구분한다. 전체 앱 chunk 합계를 첫 경로 번들로 사용하지 않았다. 변경 전 번들은 미측정이므로 감소율을 쓰지 않는다.
- 서버 DB·집계 모듈은 client로 전달하지 않는다. 상세 게임 분석 Client Component는 `next/dynamic` 별도 chunk와 Skeleton fallback으로 분리했다. 별도 차트 라이브러리는 설치되어 있지 않다. 현재 SVG 구현을 유지하며 새 라이브러리를 추가하지 않았다. dynamic component는 상세 페이지에서 즉시 표시하므로 viewport 진입까지 로딩을 미루지는 않는다.
- 기존 검색 debounce/요청 취소·오류·빈 화면·Skeleton을 유지하고 `/players/loading.tsx`를 추가했다. 데이터가 없는 상태를 속도가 빠른 성공 화면으로 측정하지 않도록 목록/HTTP 성공을 확인한다.

## 배치·retry·자원/비용 경계

- 별도 프로세스에서 실행한 타자/3 기간 배치의 실제 wall time 22,926.46ms 동안 216개 공개 HTTP를 측정했다. p95 10.92ms, max 92.05ms였다. 공개 요청이 그 배치 완료를 기다리지 않았다. 이는 별도 seed 배치의 격리 검증이지 파일 ingest 전체의 최대 event-loop 지연 보장은 아니다.
- 전체 stress seed의 12개 배치 console 측정 합계 169,981.30ms. 설정/commit을 제외한 실제 batch 시간 합계다. 원시 보고서의 배치별 값을 사용하며 전체 job wall time으로 표기하지 않는다. 처음 실행은 release_hash 열 추가 전이어서 같은 seed 결과에 열을 추가했고 이후 seed는 additive migration을 수행한다.
- 파일 게시/재계산은 선수마다 setImmediate로 양보하고, 배치/게시 변경은 마지막 atomic rename까지 private 상태다. lock EEXIST는 25/50/100ms 후 재시도하고 한도를 넘으면 409다. seed의 역할/기간 batch는 실패 시 최대 3회 재시도한다. 영속 큐·자동 재개·외부 scheduler는 없다. 동일 seed 재실행으로 복구하며 기존 공개 release는 계산 실패 시 유지된다.
- 한 선수의 상세 계산, 전체 state JSON parse/stringify와 디스크 commit은 여전히 동기 구간을 포함한다. 대량 파일 ingest를 임의 크기로 승인하거나 요청 중 CPU 무제한 계산을 허용하는 설계가 아니다. 파일 파이프라인의 생산 규모 확장은 별도 worker/영속 job 계약과 부하 검증이 필요하다.
- 대량 측정 당시 SQLite 실제 파일은 24,473,600 bytes였다. selector/기존 구현/관계형 projection을 함께 보유한 benchmark 프로세스 RSS는 460,666,176 bytes였다. 이를 서버 단독 메모리나 최대 메모리로 오인하지 않는다.
- 공급자·트래픽·무료 할당량·가격이 미정이라 무료 운영 가능 또는 월 비용을 단정하지 않는다. 선택할 플랜의 CPU 시간/메모리/최대 실행 시간/영속 디스크/egress 제한과 위 실측을 대조해야 한다. 특히 장시간 batch는 요청형 함수에 넣지 않고, 로컬 파일 저장소는 공유 영속 디스크 없는 다중 인스턴스나 ephemeral host에 그대로 배포하지 않는다.
- 비용 모델: 요청 비용 = 요청 수 × warm CPU/요청 단가, 재계산 비용 = 게시 횟수 × 배치 compute 사용량, 저장 비용 = 활성 release + snapshot + 보존 history + backup, 전송 비용 = API 응답 바이트 + 경로 JS/CSS 바이트 × 방문 수. 실제 공급자 과금 CPU와 wall time은 다르므로 혼용하지 않는다. 가격·트래픽·보존 기간이 정해진 뒤 무료 한도 초과분을 계산한다. 미측정 월 비용 수치는 쓰지 않는다.

## 재현 명령과 검증 상태

```sh
pnpm performance:bench
DEMO_PROFILE=performance pnpm db:seed
INGEST_E2E=1 DEMO_PROFILE=performance pnpm exec next build --webpack --experimental-build-mode compile
INGEST_E2E=1 DEMO_PROFILE=performance pnpm start --port 3188
# 별도 터미널, 새 서버의 첫 요청부터 측정
PERFORMANCE_BASE_URL=http://127.0.0.1:3188 PERFORMANCE_DIST=.next-ingest-e2e PERFORMANCE_BUILD_MODE=compile PERFORMANCE_LABEL=compile pnpm performance:browser
PERFORMANCE_BASE_URL=http://127.0.0.1:3188 pnpm performance:concurrency
pnpm exec vitest run --maxWorkers=2
pnpm typecheck:app
pnpm lint
# 측정 서버 종료 후 기본 150명/12 snapshot 복원
pnpm db:seed
```

- `performance:bench`: 3개 테스트 통과, 실측 목표 assertion 포함. 일반 단위 실행에서는 시간 측정 1개를 의도적으로 skip한다. 출력 동등성·페이지 경계·캐시 무효화·batch yield 검사는 일반 실행에서도 수행한다.
- 최종 단위 실행: 24파일 / 230개 통과 / 별도 timing benchmark 1개 skip. 중간 실행에서는 페이지 계약 회귀와 CPU 부하 중 5초 timeout이 발생했다. 계약을 수정하고 검증 재사용 후 동시 stress job 없이 전체 재실행해 통과했다. 실패를 성공으로 치환하지 않는다.
- 기본 fixture 복원 seed 통과. `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3188 pnpm exec playwright test tests/e2e/players.spec.ts tests/e2e/home.spec.ts tests/e2e/game-analysis.spec.ts --workers=2`: 9개 통과(검색·홈·모바일/데스크톱·접근성·lazy chart·CSV·로딩/실패 재시도).
- `pnpm lint` 및 변경 파일 Prettier 검사 통과.
- `typecheck:app` 통과. 이 명령은 Prisma 미설치 설정 파일만 제외한 strict 앱/테스트/Next 설정 검사다. **전체 `pnpm typecheck`는 prisma/config 모듈 부재로 실패**하며 DB 설정 검증 통과로 표시하지 않는다.
- `compile` 빌드 성공. 정식 build 완료/배포 성공으로 표시하지 않는다. PostgreSQL migration, 운영 quota, 현장 INP, 모바일 throttling, 실제 이미지 payload, 장시간 history 성장과 다중 인스턴스 일관성은 미검증이다.

화면 확인은 같은 profile의 서버에서 `/players` 검색/페이지 이동, `/players/demo_0_00_p0` 상세의 분석 탭, `/rankings`를 사용한다. `/rankings`는 별도의 관리자 파일 게시 저장소를 사용하므로 stress 화면 fixture seed만으로 랭킹 페이지에 게시 기록이 생기지는 않는다. 랭킹 대량 비교는 동일 snapshot 계약의 결정적 성능 패널로 수행했다. 기본 복원 후 상세 ID는 `/players/demo_0_00`이다.

다음 단계는 승인된 PostgreSQL 환경에서 migration + EXPLAIN ANALYZE/권한 쿼리 수를 검증하고, 완전한 랭킹 DTO materialization·상세 설명 payload 제한·파일 재계산 worker 격리와 모바일/현장 INP를 검증하는 것이다. 이 범위를 조용히 완료 처리하지 않는다.

## 변경 파일

- fixture/실행: `src/demo/performance.ts`, `scripts/demo-db.mjs`, `scripts/demo-snapshots.mjs`, `package.json`, `.env.example`, `src/config/env.ts`.
- 서버/모델: `src/server/db/demo.ts`, `src/server/reads/{home,home-projection,player-directory,ranking-boards,momentum}.ts`, `src/server/ingest/pipeline.ts`, `src/stats/momentum.ts`.
- 화면: `src/components/features/{player-detail,pitcher-detail}.tsx`, `src/app/(public)/players/loading.tsx`.
- 계약/인덱스: `src/contracts/momentum.ts`, `prisma/schema.prisma`, `prisma/migrations/202611030002_public_ranking_index/migration.sql`, `scripts/explain-public-ranking.sql`.
- 검증: `tests/performance/*`, `tests/unit/{performance,performance-cache,env}.test.ts`, `scripts/performance-{browser,concurrency}.mjs`, `reports/performance*.json`, `reports/seed-*.json`, `tsconfig.app.json`, `tsconfig.json`.
- 문서: `docs/{PERFORMANCE,API_CONTRACT,DECISIONS,ASSUMPTIONS,OPERATIONS}.md`.

패키지 설치·외부 수집·커밋·푸시는 수행하지 않았다. 기본 fixture와 기존 사용자 서버를 유지하며 이번 측정 서버는 검증 후 종료한다.
