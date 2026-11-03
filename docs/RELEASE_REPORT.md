# DUGOUT PULSE 출시 전 감사

감사일: 2026-11-03 (Asia/Seoul). 대상: 현재 작업 디렉터리의 package 0.1.0, Node 26.11.0, pnpm 12.10.1, Next 16.4.4. 독립 Git 저장소가 아니므로 commit 기반 릴리스 식별은 불가하다. Git 조회는 프로젝트 경로와 루트 확인에 한정했으며 홈 파일 탐색·수정·스테이징·커밋·푸시는 하지 않았다. 패키지 설치·외부 기록 수집·공개 배포도 하지 않았다.

## 출시 판정

- **REAL DATA PUBLIC RELEASE = BLOCKED.** 실제 KBO 기록의 수집·저장·가공·공개·재배포를 허용하는 공급자별 계약, 권리 범위, 유효기간, 법무·운영 승인 참조가 없다. [권리 대장](DATA_RIGHTS.md)의 A/B/C는 pending이다. 공개 웹페이지·파일 보유·출처 표기는 승인 근거가 아니다.
- **DEMO PUBLIC RELEASE = NOT_READY / 보류.** 로컬 데모 검토와 공개 출시를 구분한다. 운영 주체·문의 경로·개인정보 고지 미완성, 의존성 취약점 감사 미완료, PRD와 구현의 필터·랭킹·등록 범위 차이, 운영 환경 검증 부재가 남아 있다. 코드·테스트가 존재한다는 사실만으로 출시 승인하지 않는다.
- 실제 모드 자동 전환은 구현되지 않았다. `src/config/env.ts`는 DATA_MODE=DEMO만 받으며 배포 APP_ENV에서 관리자 수입 경로는 거부한다. 따라서 현재 실데이터 차단은 계약과 구현 양쪽에 있다.

## 증거와 실행 결과

이번 실행 로그는 [감사 디렉터리](../reports/release-audit/)에 보존한다. 문서의 과거 실행 결과를 이번 성공으로 가져오지 않았다. 전체 실행 `pnpm verify`는 **exit 1**이다.

| 검사 | 실제 명령 | 이번 결과·한계 | 증거 |
| --- | --- | --- | --- |
| lint | `pnpm verify` 내부 `pnpm lint` | 통과, 경고 허용 0 | [verify.log](../reports/release-audit/verify.log) |
| 전체 strict typecheck | 같은 실행의 `pnpm typecheck` | 통과, next typegen + tsc. 과거 prisma/config 실패 기록은 이번 결과가 아님 | [verify.log](../reports/release-audit/verify.log) |
| unit + 파일/SQLite 통합 | 같은 실행의 `node scripts/test-core.mjs` | 25파일, **235 통과 / 1 skip**. skip은 선택 성능 timing 검사. PostgreSQL 통합을 뜻하지 않음 | [verify.log](../reports/release-audit/verify.log), [coverage](../coverage/core-summary.json) |
| 핵심 coverage | 위 명령 | 타격·투구·모델·gate·admin 각 named-function 100%; 줄/분기/전체 앱 coverage 아님 | [coverage](../coverage/core-summary.json) |
| PostgreSQL migration integration | 같은 실행의 `node scripts/validate-migrations.mjs` | **실패 exit 1: TEST_DATABASE_URL 미설정**. SQL 실제 적용 미검증. psql/Docker 명령도 현재 PATH에 없음 | [verify.log](../reports/release-audit/verify.log) |
| production build | `pnpm build` 별도 실행 | **통과 exit 0**, compile·TypeScript·정적 페이지 22개·trace 완료 | [build.log](../reports/release-audit/build.log) |
| public E2E 최초 | `CI=1 VERIFY_PRODUCTION=1 PLAYWRIGHT_BASE_URL= ... pnpm test:e2e` | 서버 listen EPERM 실패. 허용 환경 재시도는 **32 실패**: 빈 baseURL 때문에 상대 URL 탐색 불가. 앱 기능 32개 실패로 오해하지 않음 | [최초](../reports/release-audit/public-e2e.log), [빈 URL 재시도](../reports/release-audit/public-e2e-retry.log) |
| public E2E 최종 | `env -u PLAYWRIGHT_BASE_URL CI=1 DATA_MODE=DEMO DEMO_PROFILE=default VERIFY_PRODUCTION=1 ADMIN_ORIGIN= PLAYWRIGHT_HTML_OUTPUT_DIR=reports/release-audit/public-html pnpm test:e2e --output=reports/release-audit/public-results` | **32 통과 (1.8분), exit 0**. production Chromium, 1 worker. 빈 baseURL 제거 후 결과이며 전체 verify 성공은 아님 | [최종 로그](../reports/release-audit/public-e2e-final.log), [HTML](../reports/release-audit/public-html/index.html) |
| admin E2E | `CI=1 APP_ENV=local pnpm test:ingest:e2e` | **3 통과**, dev server·일회용 랜덤 인증. 운영 TLS/VPN 검증 아님. 브라우저 Router 초기화 오류 로그 1건이 있어 무오류라 단정하지 않음 | [admin-e2e.log](../reports/release-audit/admin-e2e.log) |
| 정상·점검 HTTP smoke | `node scripts/deploy-local-smoke.mjs` | **통과**, 로컬 production staging APP_ENV, 정상 및 maintenance | [deploy-smoke.log](../reports/release-audit/deploy-smoke.log) |
| SQLite backup/restore | `node scripts/demo-backup-rehearsal.mjs` | **통과**: 별도 임시 복원본 integrity/schema/hash/12 snapshot, 원본 덮어쓰기 없음 | [backup.log](../reports/release-audit/backup.log) |
| production dependency audit | `pnpm audit --prod --json` | **실패 exit 1**, npm registry DNS 오류. 취약점 0건 판정 불가. dev 포함 전체 의존성 감사도 미완료 | [오류](../reports/release-audit/dependency-audit.stderr) |

[소스·fixture·lockfile SHA-256 목록](../reports/release-audit/source-manifest.json)은 143개 파일을 기록한다. `.env` 값·세션·업로드 원본·권리 증빙 원문은 보고서에 넣지 않았다. 배포 번들 전체와 원격 캐시/백업의 비밀 검사는 별도 미실행이며, 이 목록은 SBOM·서명된 릴리스가 아니다.

## PRD Must 및 수락 기준 대조

완료는 표에 명시한 로컬 DEMO 범위에 한정한다. 부분은 구현은 있으나 전체 PRD 계약/검수 미충족, 미구현은 해당 경로 없음, 차단은 외부 권한·환경 증거 필요를 뜻한다. 후속 ADR의 기능 변경은 존재하지만 PRD Must 변경 승인을 대신한다고 해석하지 않았다.

| PRD 항목 | 분류 | 구현·검사 증거와 남은 차이 |
| --- | --- | --- |
| strict 앱·기본 상태·독립 Git | 부분 | strict/lint/build 가능. 독립 저장소 미구성, 릴리스 commit 불가 |
| 버전 계약·공개 필드·fixture·추적성 (AC-03) | 완료(DEMO 입력 경계) | contracts, gate, pipeline, provider/api 테스트. 실제 공급 데이터 미검증 |
| 역할별 계산·재현·표본·0분모·휴식 (AC-04/05/06/17) | 완료(합성 계산기) | momentum/golden/batting/pitching/fixture 테스트. 실제 리그 보정·성능 예측 검증 아님 |
| 홈/검색/상세/소개 (AC-01) | 부분 | 경로·API·테스트 존재. canonical fixture는 2026 정규시즌 중심, 홈 역할별 TOP5로 PRD 상위3과 다름 |
| 모든 카드 provenance·비예측 (AC-02) | 부분 | DEMO와 출처 설명 존재. 전체 화면/숫자 카드별 100% 연결 수동 전수검수 미완료 |
| 1군 등록/시즌 출전·역할·팀·시즌/대회 (AC-07/08) | 부분 | `/published`·scope API는 날짜별 등록 snapshot/출전 구분 구현. 주 `/players`는 `membership: appeared`만 허용, 시즌 2026 고정. 팀 선택 시 해당 팀 로그에서 역할별 최근 N 기록 재집계; 기세는 전체 표본 유지 |
| URL 복원·잘못된 조건 (AC-09) | 부분 | 검색·상세·비교 URL/E2E 존재. 전체 공통 시즌·대회·팀 계약 미연결 |
| 랭킹 동점/원값/변화 (AC-11) | R05 회귀 검증 통과 | 게시 스냅샷 보드 구현. R05 수정: ADR-030 원값·공동 순위 및 공통 조회 적용. 검증 결과는 RANKINGS_VALIDATION 참조 |
| 두 선수 비교 (AC-10) | 부분 | 동일 역할 공통 막대와 다른 역할 안내, 0/1/2명 UI. query는 3명도 수용하고 read에서 2명으로 조용히 자름. 팀 조건 없음, 버전 차이·독립 부분 실패 복구 경계 미완성 |
| 로딩/빈 값/실패/오프라인 (AC-12) | 부분 | error/loading/empty component 및 모의 네트워크 테스트. 관리자 포함 IA 7화면 전체 상태 매트릭스 수동검수 미완료 |
| 별도 관리자·서버 권한 (AC-13) | 완료(로컬 DEMO 경계) | ADMIN HMAC 15분 세션, 서버 origin/role/만료/위조 검사·기본 거부. 배포는 읽기 전용. 운영 환경 접근 제어는 차단 상태 |
| 검증·미리보기·명시적 게시·정정·복구·감사 (AC-14) | 완료(파일 DEMO 통합 범위) | pipeline/provider/admin-security 테스트, 관리자 E2E. 홈/검색의 SQLite canonical과 게시 랭킹의 파일 저장소가 분리돼 전체 서비스 동시 배치 전환은 아님 |
| 접근성·모바일·대체 표 (AC-15) | 부분 | Chromium/axe/키보드/320~1440px 테스트 존재. 자동 검사 외 스크린리더·실기기 전체 과제 미검수 |
| 고정 모바일 3회 LCP/CLS (AC-16) | 미구현(수락 증거) | 기존 PERFORMANCE는 로컬 desktop lab 중심. 이번 모바일 throttling 3회 측정 없음. 현장 INP 미측정 |
| 자산·권리·개인정보 고지 (AC-18) | 차단 | 실데이터 계약 없음, 문의/운영주체 placeholder, 자산 최종 수동 승인 없음 |
| 검사·빌드·복구 (AC-19) | 부분 | build/로컬 SQLite 복원 통과. 전체 verify 실패, PostgreSQL/원격 CI/실제 호스트 롤백 미검증 |
| 사용자 5명 과제 성공률·오해 방지 | 미구현(검수) | 실제 사용자 세션·집계 증거 없음. 자동 테스트로 대체 불가 |

V1.1/V2의 계정·자동 수집·외부 연동은 Must가 아니므로 결함 수에 포함하지 않는다.

## 데이터·자산 권리

이 감사는 계약 진위나 법률 적용을 확정하는 법률 의견이 아니다. 저장소 증거 유무로 gate를 판정했다. 외부 KBO 약관의 현행성은 이번에 재확인하지 않았으며 권리 대장에 적힌 과거 고지만으로 법적 결론을 확대하지 않는다.

| 대상 | 확인 상태 | 조치 |
| --- | --- | --- |
| 실제 KBO 기록·가공 점수 | 계약/시즌·대회·필드·저장·공개 권한 확인 불가 | REAL 출시 차단. 실제 이름으로 합성 수치 교체 금지 |
| 선수/팀 사진·구단 로고 | src에 이미지 로더/외부 사진 사용 발견 안 됨, 저장소 이미지 목록은 QA 캡처 | 미사용으로 검토. 라이선스 취득 완료를 뜻하지 않음. 원격 배포 산출물은 미검사 |
| 선수·팀 명칭 | `src/demo/generator.ts`, fixtures의 가상 ID/표시명, 자체 텍스트·도형 | 실제 선수·상표와 우연한 유사성 및 DUGOUT PULSE 상표 사용 가능성은 수동 미확인. 데이터 권리와 별개 |
| UI 폰트 | globals.css의 시스템 font stack, 폰트 바이너리·@font-face·원격 폰트 없음 | 폰트를 배포하지 않는 구성 확인. 시스템 폰트의 파일 재배포 권한을 주장하지 않음 |
| 아이콘·차트 | 자체 텍스트/도형/SVG 코드, 별도 chart dependency 없음 | 제작자·허용 범위·유사성 검수와 공개 자산 대장 확정 필요 |
| 직접 의존성 | 설치 package.json의 license 필드 기록 | [목록](../reports/release-audit/direct-dependency-licenses.json). runtime 6개는 MIT 선언, test axe는 MPL-2.0. 전이 의존성/SBOM/배포 NOTICE 검수는 미완료 |

DATA_RIGHTS/RELEASE_GATES에는 “앱·fixture 없음”, “폰트 미선정” 등 이미 구현된 코드와 다른 P0 문구가 남아 있다. 해당 문서의 approved는 자체 합성 정책에 대한 승인이고 현재 배치·자산·공개 출시에 대한 서명이 아니다. 본 보고서로 권리 대장을 임의 승인하지 않는다.

## 기세 모델 설명 가능성과 비교

`src/stats/momentum.ts`의 `momentum_v0_1_0`, 설정 ID/hash, cutoff/release/역할/기간/표본/입력 참조를 사용한다. 타자 OBP·ISO·KRate, 선발 K-BB·WHIP·아웃/선발, 불펜 K-BB·WHIP·HRRate를 분리한다. 동일 시즌·대회·역할의 사전 표본 median/MAD, 개인 사전 기록, 직전 변화의 55/30/15 가중치, 표본 수축·clip·sigmoid로 0~100을 만든다. feature 기여와 baseline·제외 사유를 설명한다. 50은 모델 중립점이며 리그 평균 순위·확률이 아니다.

최소 출전/PA/BF/outs 미달, 결측, baseline 부족, 장기 미출전은 null/사유로 보류하며 0점으로 바꾸지 않는다. 휴식·사용량은 부상·피로 확률이 아니다. golden/경계/KST/역할/미래/수정 회귀가 합성 입력으로 검증됐다. 실제 기록 기반 backtest나 예측력·구장/상대/수비 보정은 검증되지 않았다.

비교의 의미는 아직 통일되지 않았다. PRD는 겹치지 않는 직전 N출전이나, ADR-016/모델 원형 V는 N−1건이 겹친 이동창, ADR-017 API deltaScore는 이전 순위 적격 게시 snapshot과 비교한다. ADR에 변경 설명은 있으나 하나의 “변화”처럼 해석할 수 없다. UI·API에 비교 기준·간격·버전을 명시하고 PRD 수락 기준을 합의해야 한다. 랭킹 보드의 표시값 정렬과 팀 필터의 비재집계도 비교 적절성 문제다.

## 역사·엔트리·오프시즌·결측·정정

- 역사: 계산기는 cutoff 이전 FINAL·asOf와 동일 release만 사용하고 미래/뒤늦은 정정을 제외한다. 과거 랭킹은 보존 snapshot의 최대 revision을 사용하며 당시 전체 manifest는 보존하지 않아 전체 선수군 재현을 보증하지 않는다(ADR-022).
- 1군: scope read는 snapshot 날짜와 valid_until을 검증하고 unknown/만료를 등록 확정으로 추정하지 않는다. 주 선수 탐색은 현재 1군 필터 미지원이며 별도 게시 scope와 통합되지 않았다.
- 시즌/대회: scope/pipeline 분리 회귀는 있으나 canonical 공개 상세·비교는 fixture 시즌/정규시즌 중심이다. 미지원 대회를 실제 데이터처럼 채우지 않는다.
- 오프시즌: 마지막 출전 경과일·휴식 임계치로 보류하고 출전 없는 날을 0기록으로 만들지 않는다. 관측 stale 48시간은 경기 일정과 연계되지 않아 비시즌 정상 무갱신도 경고할 수 있다. 공식 일정 기반 정책 미구현.
- 결측: 분모 0·필수 항목 누락은 null, 일부 feature는 정책 가중치 조건에 따라 제외·재배분된다. “충분한 표본”이 완전성/실증 정확도를 보장하지 않는다.
- 정정: 게임 키 기반 upsert, revision·출처·재계산·원자적 게시·이전 게시 복구를 테스트한다. 외부 공급자 정정 통지·철회 처리의 실제 연동은 없음. SQLite canonical과 파일 게시본 사이 정정 전파는 동일 경로가 아니다.

## 관리자·보안·개인정보·운영

서버 인증은 token SHA-256, HMAC 서명, 고정 actor/ADMIN, 15분 만료, __Host cookie, Origin/교차 사이트 거부를 사용한다. 미설정 시 기본 거부다. 배포 APP_ENV는 admin 접근 자체를 거부한다. 코드의 origin 비교를 실제 VPN/ACL로 오인하면 안 된다. APP_ENV 기본값 local이므로 배포 환경 명시 설정과 직접 요청 검사가 필요하다. MFA·개별 세션 폐기·공유 rate limiter는 없다. CSP는 inline script/style을 허용하므로 엄격한 nonce CSP 검증 통과라 보고하지 않는다.

license gate는 trusted registry의 승인/기한/용도/필드/시즌/대회를 수입·게시·읽기에서 재확인하는 경계를 가진다. 실제 API 모드는 NOT_CONFIGURED이며 운영 만료·철회 후 캐시/과거 복구/백업 삭제 의무 리허설은 미실행이다.

`/privacy`는 “출시 전 검토용 placeholder”, `/legal`은 “운영 주체·문의 창구: 미정”을 그대로 표시한다. 회원가입/분석 SDK는 없으나 URL 검색어, 테마 localStorage, 관리자 세션·감사 기록, 호스팅 IP 로그 검토가 필요하다. 개인정보 수집 없음으로 결론 낼 수 없다. 법적 문구·운영 로그 7일 목표·실제 rotation 미구현 간 차이도 해소해야 한다.

[DEPLOY_RUNBOOK](DEPLOY_RUNBOOK.md)은 정상/점검 전환·suspend·이전 이미지 복귀·SQLite seed/복원·PostgreSQL 별도 복원 절차를 제공한다. 이번 정상/점검 smoke와 SQLite 임시 복원은 통과했다. 실제 호스팅 배포/이미지 롤백·DNS·TLS·PostgreSQL restore·RTO/RPO는 검증하지 않았다. 24시간/60분은 목표이며 실측 SLA가 아니다.

관측은 API 집계/파일 경고·관리자 화면/명시적 검사이며 외부 scheduler·알림 수신자·알림 전달·프로세스 생존 감시는 미연결이다. 단일 호스트 JSONL이고 자동 rotation이 없다. 재배포 시 이력이 사라질 수 있고 다중 인스턴스 집계를 보장하지 않는다. SQLite canonical 화면과 파일 게시 관측 범위도 다르다.

속도·비용은 기존 [PERFORMANCE](PERFORMANCE.md)와 [원시 결과](../reports/performance.json)를 과거 합성 lab 증거로만 참조한다. 이번에 부하/모바일 throttling은 재측정하지 않았다. 데스크톱 로컬 LCP를 모바일 AC-16 충족으로 표시하지 않는다. 운영 제공자·트래픽·플랜·quota·디스크 보존·egress 비용과 예산 승인 미정이므로 무료 운영/월 비용/운영 p95를 확정할 수 없다.

## 남은 결함과 출시 우선순위

S0=무조건 출시 차단(권리/필수 고지/검증 게이트), S1=핵심 계약·수치 해석 오류, S2=제한된 기능/운영·검증 결손, S3=문서·경미한 품질. 보안 취약점 등급 CVSS와 같은 척도가 아니다. 확인된 계약 위반과 재현 필요 위험을 구분한다.

| ID·severity | 증거·영향 | 다음 조치·닫힘 기준 |
| --- | --- | --- |
| R01 S0 실제 권리 차단 | DATA_RIGHTS A/B/C pending, 실모드 미지원 | 소스별 권원/저장/가공/노출/기간/철회 계약·승인 및 adapter 검증 전 REAL 차단 유지 |
| R02 S0 DEMO 공개 고지 미완성 | privacy/legal placeholder, 운영자·문의 없음 | 실제 담당자/문의/호스팅 로그·보관·처리조건 확정, placeholder 0건·수동 승인 |
| R03 S0 보안 감사 미완료 | dependency audit DNS 실패 | 네트워크 허용 환경에서 prod+전체 전이 의존성 감사·critical/high 처리/판정 증빙. 현재 취약점 발견으로 단정하지 않음 |
| R04 팀 범위 교정 | 디렉터리는 팀 로그 제한 후 최근 N 재집계. 랭킹은 전체 최근 표본 내 소속 이력 필터로 명시, 전체 기세 유지 | ADR 및 이적·더블헤더·역할·시즌/대회·결측 회귀 추가. 실행 결과는 아래 후속 검증 참조 |
| R05 S1 랭킹 원값·동점 계약 위반 | 원값 정렬·공동 순위로 수정 | ADR-030 채택. API/보드 공통 조회 및 페이지 경계 회귀 테스트 추가. 검증 결과는 RANKINGS_VALIDATION 참조 |
| R06 S1 변화 비교 의미 불일치 | PRD 비중첩/V 이동창/게시 snapshot의 3종 기준 | 비교 기준·기간·버전 UI/API 명시 및 PRD/ADR 단일 수락 계약, fixture 회귀 |
| R07 S1 주 탐색 필터 미완성 | directory schema season 2026/membership appeared만, 비교 팀 없음 | 등록·미상·미출전/다시즌/대회/팀 조건을 공개 탐색에 연결·통합 검증 |
| R08 S1 전체 verify 재현 결함 | scripts/verify.mjs는 PLAYWRIGHT_BASE_URL="" 주입, config baseURL은 ?? 사용 | 빈 값을 undefined로 정규화하거나 env 제거. 일회용 PG 환경에서 pnpm verify 끝까지 exit 0 |
| R09 S2 비교 세 번째 선수 조용히 생략 | compareQuery players 문자열은 개수 제한 없음, selectComparison split.slice(0,2) | 3명 요청 명시 거부/교체 안내, 같은 버전·부분 실패 회귀 |
| R10 S2 데이터 저장소 분리 | canonical 홈/상세·파일 게시 랭킹 데이터가 서로 다른 수명주기 | 화면에 게시 범위 명시, 통일된 release 연결·배치 전환/정정 일관성 검증 |
| R11 S2 역사 manifest 미보존 | ADR-022가 과거 전체 대상 재현 미보증 명시 | 날짜별 manifest 보존·당시 전체 선수군 회귀 또는 제품 범위 제한 명시 |
| R12 S2 운영 검증 미완료 | PG/실제 호스트/TLS/ACL/공유 제한/알림/rotation/비용 미검증 | 운영 책임자 지정, staging에서 실패→알림→복구 drill과 비용 승인 |
| R13 S2 모바일 성능·사용자 검수 부재 | AC-16 모바일 3회·5명 과제 결과 없음 | 고정 장치/스로틀링 LCP/CLS 3회 중앙값, 사용자 과제 및 INP 미측정 명시 |
| R14 S2 관리자 브라우저 오류 관측 | admin E2E 중 Router action dispatched before initialization 로그, 테스트는 3 통과 | 단독 반복·콘솔 오류 수집으로 원인 재현. 기능 장애로 확정하지 않음 |
| R16 S2 모바일 비교 선택 목록 과다 | 이번 375px 캡처가 높이 10,717px, 검색 결과 150명을 한 번에 표시 | 검색/페이지 단위 선택·키보드 이동·긴 목록 렌더 비용 검수. 가로 넘침/axe 통과만으로 사용성 통과 처리하지 않음 |
| R15 S3 권리/게이트 문서 노후화 | 앱 없음·이전 타입 실패를 현재처럼 서술 | 증거 링크로 현행화, 정책 승인과 출시 승인 분리. 과거 실패 이력은 보존 |

## 화면 증거와 재검증 순서

기존 [1440 홈](qa/1440-home.png)을 직접 열어 보았으나 데이터 로딩 중인 캡처이므로 최종 데이터 표시 성공 증거로 사용하지 않는다. [기존 모바일](qa/375-home.png)·[상세](qa/1440-detail.png)·[비교](qa/1440-compare.png)는 과거 산출물이며 이번 실행 캡처와 구분한다. 이번 responsive E2E 결과와 캡처는 아래 최종 추가 기록을 따른다. 스크린샷만으로 권리·권한·산식·접근성 완료를 판정하지 않는다.

수동 재검증: `pnpm db:seed` → `pnpm build` → `APP_ENV=staging DATA_MODE=DEMO pnpm start --port 3200`. `/`, `/players`, `/players/demo_0_00`, `/players/demo_0_10`, `/rankings`, `/compare?players=demo_0_00,demo_0_03`, `/published`, `/about`, `/privacy`, `/legal` 확인. `/rankings`는 canonical seed만으로 게시 snapshot이 생기지 않으므로 빈 상태와 실제 게시 상태를 따로 검수한다. 관리자 쓰기는 이 배포 설정에서 차단돼야 하며 로컬 일회용 E2E로만 검증한다.

다음 단계는 R02/R03과 PRD 계약 충돌(R04~R08)을 먼저 해소하고, 독립 저장소·일회용 PostgreSQL·실제 staging에서 전체 verify와 운영 수동 게이트를 검증하는 것이다. DEMO의 데이터/자산 목록·담당자 승인까지 기록한 뒤에만 공개 판정을 재검토한다. 실데이터는 R01 증빙 및 별도 ADR/adapter/만료·철회 검수가 추가로 필요하다. 이 감사에서 운영 주체나 공급 권한을 추정해 채우지 않았다.

변경 파일: 본 보고서 및 `reports/release-audit/` 로그·manifest·license 목록. 실행 과정에서 `.next`, coverage, Playwright 산출물과 canonical DEMO seed가 갱신됐다. 제품 코드·스키마·의존성은 수정하지 않았다. 이번 단계는 감사 보고를 작성한 것이며 제품 Must 완료나 출시 승인 선언이 아니다.


## 최종 실행·화면 추가 기록

공개 E2E는 빈 PLAYWRIGHT_BASE_URL을 제거한 최종 실행에서 **32/32 통과, 1.8분, exit 0**. 관리자 E2E는 **3/3 통과, 18.9초, exit 0**. 공개 결과는 production 빌드, 관리자 결과는 격리된 dev 테스트 서버다. 이전 EPERM·잘못된 URL 32실패·migration 실패·audit DNS 실패를 보존한다. 따라서 전체 verify exit 1과 DEMO 공개 보류 판정은 유지한다.

이번 캡처 15개는 [public-results](../reports/release-audit/public-results/)에 있다. [1440px 홈](../reports/release-audit/public-results/ux-qa-release-responsive-and-accessibility-1440px-chromium/1440-home.png)과 [375px 비교](../reports/release-audit/public-results/ux-qa-release-responsive-and-accessibility-375px-chromium/375-compare.png)를 직접 열어 확인했다. 홈의 데이터·시각·DEMO·점수 표시는 확인됐으며, 모바일 비교는 두 선수 수치와 표본·출처를 보여주지만 150명 결과를 전부 나열해 선택 영역이 길다(R16). 320/375/430/768/1440px의 9경로 가로 넘침·axe 검사는 통과했다. 이는 전체 WCAG 준수나 실제 사용자 과제 검증을 뜻하지 않는다.

### R04 후속 로컬 검증 (2026-11-03)

- 시작: `codex/fix-ranking-raw-ties`, HEAD `6f72cd0`. 실제 Git 루트는 프로젝트 자체로 확인됨. 기존 미커밋 변경을 보존하고 `codex/team-record-scope` 생성. 커밋/푸시/배포 없음.
- 수정: `src/server/reads/player-directory.ts`, `src/server/reads/ranking-boards.ts`(범위 주석), `src/components/features/player-directory.tsx`, `src/app/(public)/rankings/page.tsx`, `tests/unit/player-directory.test.ts`, `tests/unit/ranking-boards.test.ts`, `tests/e2e/players.spec.ts`, `docs/{DECISIONS,API_CONTRACT,PRD,ASSUMPTIONS,RELEASE_REPORT}.md`. generator는 검토만 했으며 기존 이적 fixture와 테스트 내 복제 fixture를 사용했다. 초기 미커밋 변경은 이번 변경의 성과로 간주하지 않는다.
- 회귀: 팀 제한 후 최근 N, 이적 전/후 동일 날짜 더블헤더 순서, 전체 가산 표본=팀별 표본 합 및 원시 ER/아웃 기반 ERA 관계, 팀별 N 합과 전체 N 차이, 출전 없는 팀, 다른 시즌/대회, 선발/구원 역할 변경, 미제공 OPS, 캐시 팀/창 분리, 랭킹 전체 점수/원시 특성/자격 유지 검증.
- `pnpm test -- tests/unit/player-directory.test.ts tests/unit/ranking-boards.test.ts`: 스크립트 인수 전달 결과 전체 단위 247 통과/1 skipped. 랭킹 회귀 추가 후 `pnpm exec vitest run tests/unit/player-directory.test.ts tests/unit/ranking-boards.test.ts`: 19 통과.
- `pnpm test:e2e -- tests/e2e/players.spec.ts tests/e2e/rankings.spec.ts`: 첫 실행은 sandbox listen EPERM으로 서버 시작 실패. 권한 확장 실행은 인수 전달 결과 전체 33개 실행, 32 통과/1 실패(API timeout alert 20초 대기). 이후 `pnpm exec playwright test tests/e2e/players.spec.ts tests/e2e/rankings.spec.ts tests/e2e/api.spec.ts --workers=1`: 10개 모두 통과. 전체 suite의 병렬 안정성을 통과로 간주하지 않는다.
- 최종 `pnpm typecheck`, `pnpm lint`, `pnpm build`, 변경 TS/TSX Prettier 검사, `git diff --check`: 통과. 추가 테스트 작성 도중 unknown 타입 접근 오류 1건은 수정 후 typecheck/build 재통과. 최초 build와 E2E의 산출물 경합 가능성을 배제하도록 최종 build는 E2E 종료 후 재실행했다.
- 화면: `pnpm dev` 후 `/players?q=가상+A-01&team=sample_0&window=20`에서 이전 팀 출전일/표본과 전체 기세 설명 확인. `/rankings?team=sample_0`에서 소속 이력 필터 설명 확인. 390/1440px 키보드·axe·수평 overflow E2E 통과, 390px screenshot 직접 검토.
- 제한: DEMO·2026 정규시즌·시즌 출전 기준만 지원. 등록/실데이터/팀별 기세 미제공. 최근 N의 팀별 합이나 비율 단순 합을 전체와 동일하다고 주장하지 않는다. 외부 수집·패키지 설치·새 모델·DB 마이그레이션 없음.
- 되돌리기: 위 파일에서 이번 R04 추가 diff만 역적용한다. 시작 시 이미 수정된 파일이 있으므로 파일 전체 restore/reset은 사용하지 않는다. 자동 생성 next-env.d.ts는 시작 내용으로 복원했다.
- 다음 단계: R04 범위의 로컬 회귀는 충족. 전체 병렬 E2E의 timeout 안정성 확인 및 나머지 R01~R03/R05~ 게이트 충족 전 운영 공개 판정을 하지 않는다.

### R04 재검토 증빙 (2026-11-03)

- 시작 상태: 프로젝트 Git 루트, `codex/team-record-scope`, HEAD `6f72cd0`. R04/R05를 포함한 기존 미커밋 변경 18개를 확인·보존하고 `codex/team-record-scope-review` 생성. 기존 후속 검증 기록은 이번 실행 결과와 구분한다. 커밋·푸시·배포 없음.
- 이번 변경 파일: `src/server/reads/player-directory.ts`, `src/server/reads/ranking-boards.ts`, `tests/unit/player-directory.test.ts`, `tests/unit/ranking-boards.test.ts`, 이 문서. generator는 검토만 했으며 원본 fixture/데이터 계약/modelVersion/provenance를 변경하지 않았다.
- 설계: 기존 R04 ADR의 선수 탐색=팀 로그 제한 후 최근 N 재집계, 랭킹=전체 최근 표본 내 소속 이력 필터를 유지한다. 디렉터리의 중복 `teams.includes` 검사를 제거해 팀별 실제 출전 표본으로만 포함 여부를 판단한다. 랭킹 이력 정렬에 `doubleheader_no`를 추가해 경기 ID 역순인 더블헤더에서도 최근 표본의 소속팀을 정확히 선택한다. 팀별 점수는 산출하지 않는다.
- 캐시 검토: 디렉터리는 fixture identity 및 `[season, competition, team, window]`로 분리된다. 역할 필터는 모든 역할을 포함한 캐시 행에 적용한다. 전체 기세 캐시는 fixture/window 기준으로 팀과 독립이며 팀별 재계산을 하지 않는다. 랭킹 자체 집계 캐시는 없다.
- 회귀 추가: 경기 ID 사전순과 반대인 이적 전후 더블헤더의 최근 소속 이력, 불충분 표본의 등록/점수 자격 유지, 서로 다른 아웃 표본의 가중 ERA 관계, 독립 팀별 최근 N 합과 전체 최근 N 차이. 기존 시즌 교체/대회 격리/무출전 팀/역할 변경/빈 OPS 회귀도 유지한다.
- `pnpm exec vitest run`: 250 통과, 성능 측정 전용 1 skipped. 마지막 디렉터리 중복 검사 제거 후 관련 두 파일 재실행: 21 통과.
- `pnpm exec playwright test tests/e2e/players.spec.ts tests/e2e/rankings.spec.ts --workers=1`: 최초 sandbox 포트 listen EPERM으로 시작 실패. 권한 확장 재실행은 6개 모두 통과(390/1440px, axe, 키보드, 오류 재시도, 이적 선수 기록/API, 랭킹 조건 설명). 전체 E2E는 이번 재검토에서 미실행(변경 관련 2개 파일로 범위 제한).
- typecheck 최초 실행은 추가 fixture의 `kind` 리터럴 타입 확장으로 실패했고 `as const`로 수정 후 `pnpm typecheck` 통과. `pnpm lint`, `pnpm build`, 변경 TS 파일 Prettier 검사 및 `git diff --check` 모두 통과. Next가 재생성한 next-env.d.ts는 시작 상태로 복원했다.
- 화면 확인: `pnpm dev` 후 `/players?q=가상+A-01&team=sample_0&window=20`과 `/rankings?team=sample_0`. 전자는 팀별 기록/전체 기세, 후자는 소속 이력/전체 게시 수치 설명을 확인한다. 이번 실행의 `test-results/players-390.png` 직접 검토 및 양 폭 axe/overflow 검사 통과.
- 제한/다음 단계: DEMO 2026 정규시즌·appeared만 지원하며 등록 범위를 새로 추정하지 않는다. 팀별 기세의 의미/기준 집단 결정은 별도 ADR이 필요하다. 전체 E2E 및 다른 출시 게이트는 별도 확인 전까지 통과로 간주하지 않는다.
- 되돌리기: 이번 추가 테스트 2개와 더블헤더 정렬 2줄을 제거하고 디렉터리 중복 팀 검사를 복원한다. 이 문서의 재검토 증빙만 제거한다. 시작 시 미커밋 변경이 있으므로 파일 전체 restore/reset이나 브랜치 전환만으로 복구하지 않는다.

## R06/R07/R09 유지보수 (2026-11-03)

기세 변화량 정의·비교 메타데이터, 최대 2명 입력 검증, 등록 미확인과 단일 시즌 DEMO 표시를 수정했다. [변경 파일·실제 테스트·실패 이력·화면 확인·제한·복구 절차](R06_R07_R09_VALIDATION.md)를 참조한다. 최종 단위 254 통과/1 skip, 관련 production E2E 10 통과, 전체 typecheck·lint·build 통과다. 기존 미커밋 변경을 유지했으며 커밋·push·배포하지 않았다.

## R10 후속 — 공개 읽기 차단 경계 (2026-11-03)

상태: **부분 구현, R10 전체 수락 미충족**. [경로별 저장소 표와 ADR-R10](R10_PUBLICATION.md)에 현재 공개 API/페이지의 저장소·releaseId/revision, 통합 릴리스 제안, 전환·캐시·권리·잠금·복구 조건을 기록했다.

`repositories/publication.ts`의 공통 guard를 canonical SQLite 읽기와 공개 pipeline singleton에 적용했다. 연결되지 않은 파일 게시가 있으면 공개 읽기를 503 STALE_DATA로 차단한다. 실패·staging은 canonical 데모를 유지하며, 게시·정정·rollback 뒤에는 서로 다른 저장소를 조합하지 않는다. scope는 같은 상태에서 기록과 운영 이력을 읽는다. 관리자 데이터는 보존한다.

이는 통합 projection 교체를 완료한 것이 아니다. 파일 게시 후 정상 공개 조회 보존, 모든 DTO의 공통 release identity/ETag, 브라우저 요청 버전 고정과 전체 화면 전환 통합 테스트는 남아 있다. 따라서 R10을 해결 완료로 표시하거나 공개 출시 게이트를 해제하지 않는다. 실행 결과는 R10_PUBLICATION의 검증 기록을 따른다.
