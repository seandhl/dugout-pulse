# KBO 1군 데이터 공급 경로 결정 및 문의 준비

기준일·공개 자료 확인일: **2026-11-04 (Asia/Seoul)**. 조사만 수행했으며 문의 발송·회원가입·체험 신청·API 호출·실제 기록 파일 적재는 수행하지 않았다. 법률 의견이나 사용 허락을 대신하지 않는다.

## 결정

**문의 경로는 KBO의 권리 담당 확인 → 스포츠투아이 공급 협의 순으로 선택한다.** Sportradar는 대체 견적·필드 확인 후보로 둔다. 최종 공급자 선정과 계약은 보류한다. KBO/KBOP의 담당 구분이나 제3자의 재허락 권한을 추정하지 않는다. KBO에 먼저 현행 권리 주체와 지정 공급 창구를 확인한다.

- 채택: 문의 우선순위와 증빙 기반 차단 유지. 공개 웹 자료는 수집 허락이 아니다.
- 제안: KBO가 권원을 확인한 스포츠투아이의 계약형 API 또는 허가된 배치 파일을 우선 협상한다. API가 없어도 동일한 권리·필드 요건의 파일 공급을 검토한다.
- 미선정: 실제 공급자, 가격, 최초 시즌, 계약 기간, 갱신 주기. 전 항목 서면 확인 전 REAL 사용 불가.
- A-CONTRACT / B-OFFICIAL-API / C-LICENSED-FILE은 계속 **pending**. 아래 후보 ID는 조사 식별자이며 runtime sourceId나 승인 registry가 아니다. LICENSED_API는 **NOT_CONFIGURED** 유지.

## 공개 근거와 문의처

공개 문서의 존재와 우리 서비스에 대한 권한을 분리한다. 검색에서 찾지 못한 것은 부존재의 증명이 아니다. 아래 링크는 소개·약관·개발 문서만을 근거로 쓰며 실제 선수 기록은 이 문서에 복제하지 않는다.

| 근거 ID | 공식 공개 출처 | 확인 내용과 한계 |
| --- | --- | --- |
| S1 | [KBO 약관 개정 고지](https://www.koreabaseball.com/kbo/board/notice/View.aspx?boardSe=12148) | 공고 2026-09-15, 시행 2026-10-14. 사전 서면 동의/공식 API 없는 자동 대량 반복 수집과 수집 데이터의 재판매·재배포·연동·2차가공 제한 고지. 공식 API 언급은 접근 허락이나 개발 문서가 아님. 하단 대표전화 02-3460-4600. |
| S2 | [KBO 현행 모바일 가입 약관](https://m.koreabaseball.com/Member/Join/Accessterms.aspx?appCk=false) | 서비스 제공 회사로 스포츠투아이를 명시하고 자동 수집 제한을 게시. 회사의 운영 관계는 확인되지만 데이터 재허락 권한·독점성·유효 계약 기간은 입증하지 않음. |
| S3 | [스포츠투아이 홈페이지](https://www.sports2i.com/) | 공식 도메인 접속은 됐으나 조사 도구에서 본문 추출 불가. 공개 API 사양·가격·영업 담당을 검증하지 못함. 내부 요청 분석이나 우회는 하지 않음. |
| S4 | [개발자가 게시한 KBO Google Play 등록](https://play.google.com/store/apps/details?hl=ko&id=com.sports2i.kbo) | 공식 앱 설명 및 개발자 스포츠투아이 연락처 support@sports2i.com, +82 31-706-7637 확인. 앱 지원용 공개 창구이며 데이터 영업 전용으로 확인되지 않음. 담당 부서 연결 요청에만 활용. |
| S5 | [Sportradar Global Baseball FAQ](https://developer.sportradar.com/baseball/reference/global-baseball-faq) | KBO를 커버리지 대상으로 언급하나 경기별 coverage 확인을 요구. KBO 공식 공급 지위·재허락 권한·요구 필드 전부의 제공 증명은 아님. |
| S6 | [Sportradar API Basics](https://developer.sportradar.com/baseball/docs/global-baseball-ig-api-basics) | Global Baseball v2의 인증·JSON/XML·시즌 관련 피드 문서 존재 확인. 문서 열람만 했으며 인증키 발급·데이터 요청 없음. |
| S7 | [Sportradar Sports Data API](https://sportradar.com/media-tech/data-content/sports-data-api/?lang=en-us) | 맞춤 견적 문의 안내. 다른 리그의 예시 요청 한도를 KBO에 적용하지 않음. 체험 제공은 상업 이용·공개 승인 아님. |
| S8 | [Sportradar 공식 Contact](https://sportradar.com/contact/) | 공식 영업 연결 경로. 공개 페이지의 Contact Us 이용 제안이며 실제 제출은 하지 않음. 담당 이메일을 추측하지 않음. |

## 후보별 공식성·계약 절차·공급 형식

| 후보 | 공식성 및 권원 | 문의 경로 | 절차: 공개 확인 / 프로젝트 제안 | API·파일 문서 |
| --- | --- | --- | --- | --- |
| P-KBO | KBO 자체 공식 창구(S1). KBOP 포함 실제 계약 주체와 권한 위임은 미확인 | 02-3460-4600에 데이터 라이선스 담당·업무 이메일 연결 요청. 대표번호이며 전용 영업번호 아님 | 공개: 자동 수집 제한과 서면 동의 언급. 제안: 담당 확인 → 사용 계획 전달 → 권원·필드·조건 회신 → 계약 검토 | 공개 개발자 API 문서·인증 신청 절차 미확인. 웹 화면을 API로 취급하지 않음 |
| P-SPORTS2I | KBO 약관상 서비스 회사(S2), 공식 앱 개발자(S4). 현행 KBO 기록 공급·재허락 범위는 KBO 서면 확인 필요 | support@sports2i.com 또는 +82 31-706-7637로 데이터 사업 담당 연결 요청(S4) | 공개된 데이터 계약 신청 절차 미확인. 제안: 권원 확인 → 데이터 명세/견적 → 이용 범위 협의 → 계약·검토 | 홈페이지 본문 검증 제한(S3). API/CSV/JSON 제공 여부·사양 미확인 |
| P-SPORTRADAR | 자체 개발 문서에 KBO 커버리지 언급(S5). KBO의 공식 지정 여부와 한국 내 재허락 권원 미확인인 제3자 후보 | 공식 Contact(S8), Sports Data API 영업 안내(S7) | 공개: 맞춤 견적 문의. 제안: KBO 필드별 coverage·권원 서면 확인 → 견적 → 계약 검토. 가입·trial은 별도 승인 필요 | Global Baseball v2 문서 존재(S6). KBO의 실제 필드·시즌별 제공은 별도 확인 |

권한 있는 제3자로 **확정된** 후보는 아직 없다. Sportradar의 다른 리그 계약이나 스포츠투아이의 앱 운영을 KBO 기록 재허락 증거로 대체하지 않는다.

## 필요한 필드와 현재 확인 수준

아래는 공급 요청 명세이며 기존 공개 API/ingest 스키마 변경이 아니다. 모든 후보에서 KBO 1군 기준 완전성이 미확인이다.

| 요구 범위 | 계약 부속서에 요청할 내용 | KBO / 스포츠투아이 | Sportradar |
| --- | --- | --- | --- |
| 선수별 출전 로그 | 경기·선수 ID, 날짜, 당시 팀, 실제 출전/선발/교체, 타격·투구 원천 기록, 선발/불펜 역할, 정정 버전 | 공급 가능 여부 미확인 | 일반 피드 문서만 확인; KBO 선수별 로그·역할·통계 완전성 미확인 |
| 안정적 선수 ID | 동명이인 구별, 재등록·개명·이적 시 유지, 삭제/병합/변경 매핑, 외부 ID 연결 권한 | 미확인 | 공급자 ID와 KBO ID 대응·안정성 미확인 |
| 팀 이력 | 소속 유효 시작/종료 시각, 이적/방출/재입단 이벤트, 경기 당시 소속, 정정 이력 | 미확인 | 프로필의 현재 팀이 역사적 소속을 대체하는지 확인 필요 |
| 시즌·대회 | 제공 시작/종료 시즌, 정규시즌/포스트시즌 구분, 1군 한정, 시범·퓨처스 제외, 우천취소·서스펜디드·더블헤더 ID | 미확인 | 시즌 관련 피드 문서 존재; KBO 과거 시즌·대회별 깊이 미확인 |
| 로스터 스냅샷 | 날짜/시각별 1군 등록·말소, 효력 시각, 과거 재구성·정정, 출전하지 않은 등록 선수 포함 | 미확인 | 경기 라인업/시즌 선수 목록이 1군 엔트리 스냅샷을 뜻하지 않음; 미확인 |
| 추적성 | sourceId 대응, 원천 ID, as-of와 전달 시각, 시즌·대회, 표본 계산 근거, 정정·삭제 통지 | 미확인 | 응답 필드와 프로젝트 provenance 대응 검토 필요 |

## 권리·운영 조건 비교

각 칸은 독립 심사 항목이다. 미확인은 사용 불가이며 요금 지불이나 API 인증 성공으로 해제되지 않는다.

| 항목 | P-KBO | P-SPORTS2I | P-SPORTRADAR |
| --- | --- | --- | --- |
| 수집/수입 | 서면 허락·제공 방식 미확인(S1) | 계약상 허용 미확인 | KBO 대상 계약 허용 미확인 |
| 원본 저장 | 서버·캐시·로그·백업·보관 기간 미확인 | 동일 항목 미확인 | 동일 항목 미확인; TTL은 저장 라이선스가 아님 |
| 가공 | 기세 모델·집계·정규화 허용 미확인 | 허용 미확인 | 허용 미확인 |
| 공개 | 원천 수치·파생 점수·차트의 웹/모바일 노출 미확인 | 허용 미확인 | 허용·지역·매체 범위 미확인 |
| 재배포 | API/CSV/다운로드/제3자 전달 미확인 | 허용 미확인 | 허용 미확인; 화면 노출과 별도 |
| 갱신·요청 한도 | 빈도·지연·정정 SLA 미확인 | 빈도·배치·호출 한도 미확인 | KBO 계약 quota·polling·지연·정정 SLA 미확인(S7의 타 리그 한도 전용 금지) |
| 가격 | 공개 견적 미확인 | 공개 견적 미확인 | 맞춤 견적 안내(S7); KBO 가격 미확인 |
| 상업 이용 | 광고·유료화·후원·국가별 허용 미확인 | 미확인 | 미디어 서비스 판매 안내와 우리 서비스의 상업 권한은 별개; 미확인 |
| 계약 유효기간 | 시작·종료·갱신·철회·종료 후 파생물 처리 미확인 | 동일 항목 미확인 | 동일 항목 미확인 |
| 출처 표기 | 문구·로고 의무·위치 미확인 | 미확인 | 미확인 |
| 판정 | pending / 구현 차단 | pending / 구현 차단 | pending / 구현 차단 |

## 별도 이름·사진·로고 검토

실제 선수 이름(한글/영문·표시명·동명이인 식별 포함)은 기록 접근권과 별도로 성명 이용·인격권·개인정보 및 상업 서비스 표시 범위 검토 대상으로 둔다. 이름을 일률적으로 자유 이용 또는 일률적으로 라이선스 필수라고 단정하지 않는다. 선수 사진은 저작권·초상 이용, 구단/KBO 로고는 상표·저작권·브랜드 가이드와 허용 매체·변형·기간을 각각 확인한다. 데이터 계약이 이 자산들을 자동 포함한다고 해석하지 않는다. 미승인 실명·사진·로고 적재/노출 없음.

## 문의 이메일 초안 — 발송하지 않음

### KBO 담당 확인 후 전달용

수신: 대표전화로 확인한 데이터 라이선스 담당 업무 이메일(아직 미확인)

제목: [Dugout Pulse] KBO 1군 기록 데이터 이용 권한 및 공식 공급 경로 문의

안녕하세요. 한국어 모바일 웹 서비스 Dugout Pulse의 데이터 공급 경로를 검토하고 있습니다. 현재는 자체 가상 DEMO만 사용하며 실제 기록 수집이나 공개는 하지 않고 있습니다.

KBO 1군 선수의 경기별 출전/타격/투구 로그, 안정적 선수 ID, 소속 팀 이력, 시즌 및 정규시즌·포스트시즌 구분, 날짜별 1군 등록·말소 스냅샷이 필요합니다. 해당 자료를 공식적으로 공급하고 이용 허락할 계약 주체와 담당 창구를 안내 부탁드립니다. 스포츠투아이 또는 다른 지정 공급업체를 통한 계약이 필요한지도 확인 부탁드립니다.

웹/모바일에서 기록을 집계해 타자·선발·불펜별 기세 점수와 차트를 제공하려 합니다. 최초 시즌·과거 제공 기간과 유료화·광고 여부는 아직 미정이므로 각각 가능한 범위와 견적 조건을 부탁드립니다. 원본 재배포/API/다운로드는 화면 공개와 분리해 허용 여부를 확인하고자 합니다.

수집·서버 저장(캐시/로그/백업 포함)·가공·원천/파생물 공개·재배포·상업 이용의 권리를 각각 명시할 수 있는지, API 또는 허가 파일 공급 방식과 문서, 갱신 주기·요청 한도·정정 SLA, 요금·최소 계약·시작/만료·해지/철회·종료 후 원본/파생물 처리·표기 의무를 알려 주실 수 있을까요? 선수 이름·사진·로고의 권리 주체와 별도 허락 필요 여부도 안내 부탁드립니다.

승인 전 실제 기록 샘플 전달 대신 필드 명세와 가상 예시를 부탁드립니다. 데이터 권원 및 재허락 범위의 서면 증빙과 계약 절차를 확인한 뒤 검토하겠습니다. 감사합니다.

발신: [운영 책임자 성명 / 조직 / 업무 이메일 — 발송 전 입력]

### 스포츠투아이 담당 연결 및 공급 협의용

수신: support@sports2i.com (앱 개발자 공개 연락처; 데이터 사업 담당 연결 요청)

제목: [담당 부서 연결 요청] Dugout Pulse KBO 1군 데이터 라이선스·API/파일 공급 문의

안녕하세요. 공개된 KBO 앱 개발자 연락처를 통해 데이터 사업 담당 연결을 요청드립니다. KBO 1군 출전 로그·선수 ID·팀 이력·시즌/대회·날짜별 등록 스냅샷의 계약형 공급을 검토 중입니다. 현재 가상 DEMO만 운영하고 실제 기록은 수집하지 않습니다.

위 KBO 문의 본문의 요구 필드와 권리·요금·기간 질문에 대한 답변 및 API/파일 명세를 부탁드립니다. 특히 귀사의 현행 KBO 데이터 공급·재허락 권한, 계약 주체 및 KBO 별도 승인의 필요 여부를 서면으로 확인하고자 합니다. 게임 라인업과 1군 등록 스냅샷의 차이, ID 안정성, 과거 소속 이력 및 정정 이력 제공 여부도 확인 부탁드립니다. 실데이터 대신 가상 예시로 협의 부탁드립니다.

발신: [운영 책임자 성명 / 조직 / 업무 이메일 — 발송 전 입력]

### Sportradar 영업 전달용

수신: 공식 Contact를 통해 확인한 Media & Tech / Sports Data API 담당(이메일 미확인)

Subject: KBO Global Baseball licensing and field coverage inquiry — Dugout Pulse

Hello, we are evaluating a licensed data source for Dugout Pulse, a Korean-language mobile web analytics service. We currently use synthetic DEMO data only and have not requested or imported real player records.

Please confirm your authority to license KBO data for our intended Korean web/mobile service, including any underlying permissions or separate KBO approvals. We need player game appearances and batting/pitching logs, stable player IDs and KBO ID mappings, historical team membership with effective dates, season/regular-season/postseason classification, and historical daily first-team registration/deregistration snapshots, including registered players who did not appear in a game. Please distinguish roster registration from game lineups and confirm historical coverage and corrections per field.

Please quote collection, raw storage/cache/logs/backups, derived momentum analytics, public raw/derived displays, redistribution/API/downloads, and commercial use separately. Please specify update latency, quotas, correction SLA, attribution, territory/media restrictions, pricing, minimum term, effective/expiry dates, renewal, termination and post-termination treatment of raw and derived data. Commercialization and initial seasons remain undecided; please provide options. Player names, images and club/league logos require separate rights clarification.

Please provide documentation and synthetic examples only until rights and evaluation terms are approved. We are not requesting trial activation or real data delivery at this stage. Thank you.

Sender: [name / organization / business email — fill before sending]

## 답변 기록 및 다음 단계 진입 조건

문의 발송 상태: **미발송**. 응답·견적·계약 증빙 없음. 담당 운영자·법무 검토자 실명 미배정. 발송 전 발신자와 대상 업무 창구를 확인하고 사용자의 발송 지시를 받아야 한다.

응답은 후보 ID, 회신일, 계약 주체, 담당 역할, 답변 대상 필드/권리, 증빙의 안전한 참조 ID·버전·해시·관련 조항, 검토일·승인 역할로 기록한다. 계약서 원문·비밀·개인 연락처는 저장소에 넣지 않는다. 미답변은 pending으로 남긴다.

1. KBO 권리 담당 및 공급자의 권원/재허락 증빙 확인.
2. 위 필드와 권리·운영 조건 전부의 명시적 서면 답변 및 계약 검토. 부족한 필드는 범위 축소 ADR과 수락 기준 재합의 없이는 생략하지 않음.
3. 성명·이미지·로고의 독립 검토, 책임자·법무·운영 승인, [권리 대장](DATA_RIGHTS.md) 업데이트.
4. 승인 후에도 별도 구현 ADR, vendor→canonical 매핑·필요 마이그레이션·회귀테스트와 리뷰를 거쳐야 함. 문서 결정만으로 LICENSED_API나 live 전환을 해제하지 않음.

기존 sourceId/licenseId/batchId/asOf/season/competition/sampleSize·provenance·modelVersion 및 DEMO/REAL 분리를 보존한다. 이번 변경은 문서뿐이며 공개 API·스키마·어댑터·권리 gate 변경은 없다.

## 작업 기준과 검증

시작 브랜치 codex/momentum-context-ux, HEAD 6f72cd0. 실제 Git 루트는 프로젝트 디렉터리로 확인했고 홈 파일은 탐색하지 않았다. 새 작업 브랜치 codex/data-provider-decision. 기존 미커밋 변경은 보존한다. Node 26.11.0 / pnpm 12.10.1 / Next 16.4.4. 검증 결과는 아래에 기록한다. 과거 문서의 테스트 결과를 이번 결과로 취급하지 않는다.

### 실제 실행 결과 (2026-11-04)

- `pnpm test -- tests/unit/provider.test.ts tests/unit/security-review.test.ts`: exit 0. 이 인자 전달에서는 전체 suite가 실행되어 **30파일, 270 통과, 1 skip**이었다. 선택적 성능 skip은 성공 수에 포함하지 않음. 기존 LICENSED_API NOT_CONFIGURED·권리 gate 회귀 포함.
- `CI=1 PLAYWRIGHT_PORT=3197 pnpm test:e2e tests/e2e/api.spec.ts`: 최초 샌드박스 실행은 loopback listen EPERM으로 exit 1, 테스트 본문 미실행. 동일 명령을 권한 확장해 재실행한 결과 **Chromium 4/4 통과**, exit 0. HTTP 계약, DEMO 상세, 네트워크 오류/재시도, timeout/빈/부분 응답 검사. 전체 E2E·실공급 연동 검증은 미실행이며 이번 문서 변경 범위에 맞춰 API suite만 실행했다.
- `pnpm typecheck`: exit 0. `pnpm lint`: exit 0.
- `pnpm exec prettier --check docs/DATA_PROVIDER_DECISION.md docs/DATA_RIGHTS.md`: 통과. `git diff --check`: 통과. 문서 검사는 앱 동작 검증과 별개다.
- `pnpm build`: exit 0, production compile·TypeScript·정적 페이지 생성 통과.

화면 확인: 문서 미리보기에서 후보별 표와 이메일 초안을 확인한다. 앱은 `pnpm dev` 후 http://127.0.0.1:3000/players 에서 기존 DEMO 안내를 확인할 수 있다. 이번 작업에 UI 변경은 없으며 실기기·스크린리더 수동 검수는 미실행이다.

제한: 공급자 회신·법무 검토·권리 승인 없음. 공개 자료 조사만으로 공급 가능성·요금·기간·필드 완전성을 확정하지 못한다. 외부 데이터 수집·패키지 설치·계정 연결·배포·push는 하지 않았다.

되돌리기: DATA_PROVIDER_DECISION.md 신규 파일과 DATA_RIGHTS.md 6절·기준일 변경, DECISIONS.md ADR-DATA-PROVIDER-01, ASSUMPTIONS.md 데이터 공급 조사 경계 절만 역수정한다. 기존 미커밋 변경이 있으므로 파일 전체 checkout/reset을 사용하지 않는다. 코드·DB 마이그레이션 rollback은 없다.

단계 판정: **공개 조사 및 문의 준비 완료 / 실제 공급자 확정 보류 / 구현 차단 유지**. 다음 단계는 담당자 지정과 발송 지시 후 문의, 서면 회신·계약·권리 검토이며 그 전에는 실제 데이터 구현에 진입하지 않는다.
