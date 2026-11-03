# Phase 2 UX 감사 — 현행 DEMO

감사일: 2026-11-03 KST. **문서·화면 증거만 추가한 감사이며 개선 구현/출시 승인이 아니다.**

## 1. 기준선과 범위

- 시작 브랜치 `codex/r10-atomic-release`, HEAD `6f72cd03620f4ca8278b8c0673437d30f9deac8c` (`docs: record successful local and CI Verify evidence`). 작업 브랜치 `codex/ux-audit-phase2`.
- `git rev-parse --show-toplevel`의 실제 결과는 `/Users/seandhlee/projects/dugout-pulse`. AGENTS의 ‘홈 디렉터리 Git 루트’ 문구와 현재 상태는 다르다. 홈 파일은 탐색하지 않았다.
- 시작 때 API/모델/조회/UI/테스트/docs의 미커밋 변경 및 미추적 R10 관련 파일이 이미 있었다. **HEAD 단독이 아닌 기존 변경을 포함한 작업 트리**가 감사 대상이다. 이를 reset/stash/스테이징/커밋하지 않았다.
- 앱 코드·계약·modelVersion·provenance·DEMO/REAL 경계·기존 DB/게시 상태를 수정하지 않았다. 패키지 설치, 외부 수집, 계정 연결, 게시, push, 배포 없음. 기존 `.demo/fixture.sqlite`를 읽었으며 seed/reset/publish를 실행하지 않았다.
- 확인: `AGENTS.md`, `package.json`, `playwright.config.ts`, `README.md`, `docs/UI_SYSTEM.md`, `SCREEN_SPECS.md`, `TESTING.md`, `DECISIONS.md`, `ASSUMPTIONS.md`, `DATA_RIGHTS.md`; `src/app/(public)` 공개 경로, `src/components/features/*`, `shell.tsx`, `ui/index.tsx`, `globals.css`와 관련 API/read.
- Node 26.11.0 / pnpm 12.10.1 / Next 16.4.4 / React 19.3.1 / Playwright 1.64.1 / axe 4.11.0. 설치된 Chromium, headless, ko-KR, Asia/Seoul, viewport 높이 900 CSS px. 실제 기기나 Safari 결과가 아니다.
- 로컬 `http://127.0.0.1:3107`, `pnpm dev --port 3107` 실행. sandbox의 listen EPERM 이후 승인된 loopback 실행으로 확인했다. 개발 서버의 Next 개발 표시가 캡처에 포함된다. 배포 UI로 해석하지 않는다.
- canonical DEMO: 가상 A-01 `demo_0_00`, 출처 `synthetic_v2`, 2026 정규시즌, 기준일 `2026-11-03T00:00:00.000Z`(09:00 KST), 모델 `momentum_v0_1_0`. 랭킹은 별도 게시 저장소 revision 0 / 기록 미갱신. 실제 구단 로고·사진·승인되지 않은 기록은 디자인 전제에서 제외한다.

## 2. 재현 가능한 화면 근거

모든 파일은 이번에 새로 생성했다. 기존 `docs/qa/*.png`를 재사용하지 않았다. 총 44개 PNG(기본 25개·상태 6개·보조 화면/키보드/테마/흐름/PC 첫 화면 13개)를 추가했다. 전체 화면 PNG와 경로·폭·넘침·h1·DEMO·작은 조작 대상 측정은 [evidence.json](qa/phase2/evidence.json), 추가 응답은 [extra-evidence.json](qa/phase2/extra-evidence.json), 테마별 axe·사용 흐름은 [interaction.json](qa/phase2/interaction.json)에 기록한다. 경과 시간에 따라 상태가 바뀌는 로딩/오류는 아래 주입 조건을 따라 재현한다.

| 화면 / 정확한 경로 | 320px | 375px | 430px | 768px | 1440px |
| --- | --- | --- | --- | --- | --- |
| 홈 `/` | [캡처](qa/phase2/320-home.png) | [캡처](qa/phase2/375-home.png) | [캡처](qa/phase2/430-home.png) | [캡처](qa/phase2/768-home.png) | [캡처](qa/phase2/1440-home.png) |
| 탐색 `/players` | [캡처](qa/phase2/320-players.png) | [캡처](qa/phase2/375-players.png) | [캡처](qa/phase2/430-players.png) | [캡처](qa/phase2/768-players.png) | [캡처](qa/phase2/1440-players.png) |
| 상세 `/players/demo_0_00` | [캡처](qa/phase2/320-detail.png) | [캡처](qa/phase2/375-detail.png) | [캡처](qa/phase2/430-detail.png) | [캡처](qa/phase2/768-detail.png) | [캡처](qa/phase2/1440-detail.png) |
| 1명 비교 `/compare?players=demo_0_00` | [캡처](qa/phase2/320-compare.png) | [캡처](qa/phase2/375-compare.png) | [캡처](qa/phase2/430-compare.png) | [캡처](qa/phase2/768-compare.png) | [캡처](qa/phase2/1440-compare.png) |
| 랭킹 `/rankings` | [캡처](qa/phase2/320-rankings.png) | [캡처](qa/phase2/375-rankings.png) | [캡처](qa/phase2/430-rankings.png) | [캡처](qa/phase2/768-rankings.png) | [캡처](qa/phase2/1440-rankings.png) |

PC 첫 화면: [홈](qa/phase2/1440-home-viewport.png), [탐색](qa/phase2/1440-players-viewport.png), [상세](qa/phase2/1440-detail-viewport.png), [2명 비교](qa/phase2/1440-compare-viewport.png), [랭킹](qa/phase2/1440-rankings-viewport.png).

추가: [선발 상세](qa/phase2/375-pitcher.png) `/players/demo_0_10`, [선발 2명 비교](qa/phase2/375-compare-pitchers.png) `/compare?players=demo_0_10,demo_0_11&window=5`, [게시·시점](qa/phase2/375-published.png) `/published`, [소개](qa/phase2/375-about.png) `/about`.

재생성 시 기존 패키지만 사용한다. 저장소 루트에서 서버 실행 후 다음 예시의 폭·경로·이름을 위 표에 맞춰 바꾼다. 서버 데이터가 변경되면 화면도 달라지므로 revision/as-of/모델과 기존 작업 트리 변경을 함께 비교해야 한다.

```sh
pnpm dev --port 3107
# 별도 터미널; 테스트/빌드와 .next를 공유하는 서버는 동시에 빌드하지 않는다.
pnpm exec playwright screenshot --browser chromium --viewport-size '375,900' --wait-for-selector 'ul[aria-label="선수 검색 결과"]' --wait-for-timeout 1200 --full-page 'http://127.0.0.1:3107/players' /tmp/375-players.png
pnpm exec playwright screenshot --browser chromium --viewport-size '1440,900' --wait-for-timeout 2000 --full-page 'http://127.0.0.1:3107/compare?players=demo_0_00,demo_0_03' /tmp/1440-compare.png
```

캡처 자동화는 Playwright `newContext({locale:'ko-KR', timezoneId:'Asia/Seoul', colorScheme:'light'})`, `setViewportSize`, `goto`, 응답 대기, `screenshot({fullPage:true})`를 사용했다. CLI 예시는 OS locale/timezone을 상속하므로 날짜 문자열까지 동일하게 하려면 위 context 옵션을 사용한다. 단순 고정 지연 캡처는 느린 환경에서 완료를 보장하지 않으므로 결과 영역이 표시된 뒤 캡처한다.

## 3. 실제 사용자 흐름

| 단계 | 조작·재현 | 현행 결과 / 판정 |
| --- | --- | --- |
| 홈 → 탐색 | 상단 ‘선수 탐색’ 클릭 | 이동 가능. 홈 검색은 현재 역할 내 검색이라 전체 선수 검색과 의미가 다르며 역할 선택은 아래쪽에 있음. UX-02/03 |
| 탐색 → 상세 | ‘선수명 검색’에 `가상 A-01` 입력, 결과 선수 링크 클릭 | 350ms 자동 검색 후 `/players?q=...`; 상세는 `/players/demo_0_00`으로 진입. 팀·기간 조건을 전달하지 않음. UX-04 |
| 상세 → 비교 | ‘선수 비교에 추가’ | `/compare?players=demo_0_00`. 상세 기간을 바꿔도 기본 최근 10출전으로 진입함. UX-04 |
| 두 번째 선수 | 검색 결과의 ‘선수 2로 가상 A-02 선택’ | 두 슬롯이 URL에 보존됨. 빈 슬롯 바로 옆 선택 CTA보다 150명 링크 목록 탐색에 의존함. UX-05 |
| 비교 → 랭킹 | 상단 ‘기세 랭킹’ | 이동 가능. 모바일 하단에는 비교가 없고 상단으로 돌아가야 함. UX-01 |
| 랭킹 → 돌아오기 | 브라우저 뒤로 | 비교 선택 URL 복귀를 검사. 상단 ‘선수 비교’는 새 `/compare`로 가므로 선택을 지움. ‘이전 화면’과 메뉴 신규 진입 구분 필요. UX-04 |
| 상세 → 목록 | ‘선수 목록으로’와 ‘뒤로 이동’ 비교 | 전자는 항상 `/players` 초기화, 후자는 history.back. 검색 조건 유지 목적의 두 동작 차이가 라벨에서 불명확함. UX-04 |
| 랭킹 → 상세 | 현재 revision 0 | 클릭 가능한 정상 순위가 없어 **실행 불가**. 게시 스냅샷 상세는 소스에서 별도 UI임을 확인했으며 동일 상세 흐름 완료로 세지 않음. UX-09 |

이 흐름의 화면 전환은 마우스/프로그램 클릭으로 수행했다. Tab으로 처음 skip link에 진입하는 검사는 별도로 수행했다. 전체 흐름을 키보드만으로 완료했다거나 스크린리더로 검수했다고 주장하지 않는다.

## 4. 화면별 결함·심각도·소요 추정

P0: 오인 게시/사용 불가 수준의 즉시 차단, P1: 핵심 해석·이동·접근을 크게 방해, P2: 반복 마찰/상태 불명확, P3: 정리. 시간은 숙련 개발자 1인의 구현+관련 회귀 검증 추정이며 디자인 승인·데이터 저장소 통합은 별도다. **관측과 제안을 구분하며 다음 변경 승인으로 간주하지 않는다.**

| ID / 우선순위 | 화면·재현 근거 | 관측 / 영향 | 개선 제안·검증 기준 | 추정 |
| --- | --- | --- | --- | --- |
| UX-01 / P1 | 전역 375px [상세](qa/phase2/375-detail.png), [shell](../src/components/shell.tsx) | 하단 nav가 `links.slice(0,4)`라 비교 없음. 비교 화면에서 하단 현재 메뉴도 없음. 상단·하단 메뉴 중복으로 첫 콘텐츠가 밀림 | 홈/탐색/비교/랭킹을 핵심 nav로 제안, 게시·소개는 보조 메뉴. 모든 핵심 경로를 하단에서 한 번에 이동, aria-current 일치 | 3–5h |
| UX-02 / P1 | 홈 [1440 첫 화면](qa/phase2/1440-home-viewport.png), [home-dashboard](../src/components/features/home-dashboard.tsx) | ‘최근 상승세 TOP5’는 변화량이 아닌 현재 score 내림차순. 이전 게시 대비 상승과 혼동 가능 | 현재 동작은 ‘최근 기세 점수 TOP5’로 제안. 실제 변화 탭 도입은 승인된 이전 게시 비교만 사용, 모델 내부 창 차이와 혼합 금지 | 1–2h |
| UX-03 / P2 | 홈 [375](qa/phase2/375-home.png) | 검색은 현재 역할만 대상으로 하지만 역할 컨트롤이 검색보다 아래에 있음. 홈 역할·기간은 URL에 없음 | 검색 옆 역할/범위 명시 및 ‘전체 선수 탐색’ CTA. 역할·기간 URL 보존은 현행 계약 확인 후 제안 ADR | 4–6h |
| UX-04 / P1 | [상세](qa/phase2/375-detail.png), [비교](qa/phase2/375-compare.png), 위 사용자 흐름 | 탐색 링크는 ID만, 비교 추가도 ID만 전달. 목록 링크 초기화, 상세 기간 변경 replace로 조건을 덮어씀 | 지원되는 역할·기간·시즌·대회를 이동 시 유지하고 ‘검색 결과로 돌아가기’ 제공. team 의미가 다른 화면에는 ‘전체 팀 기준’ 전환을 명시. 미지원 release 계약을 UI만으로 가정하지 않음 | 1–2d |
| UX-05 / P1 | 비교 [375](qa/phase2/375-compare.png), [PC](qa/phase2/1440-compare-viewport.png) | 150명·각 2개 링크를 한 번에 나열. 빈 슬롯에도 ‘선택 해제’. 상단 GET 폼은 경계/간격 없이 이어짐. 모바일 두 패널 세로 배치로 같은 지표 비교에 왕복 스크롤 필요 | 빈 슬롯 ‘두 번째 선수 선택’, 검색 결과 제한/명시 페이지, 선택됨 상태와 역할 안내. 모바일은 지표별 두 값 카드, PC는 지표 정렬 표. 최대 2명 URL 검증 유지 | 1–2d |
| UX-06 / P1 | 탐색 [375](qa/phase2/375-players.png), [320](qa/phase2/320-players.png) | 8개 필드+긴 도움말을 지나야 결과. 20장 카드로 페이지 버튼이 매우 아래. 자동 검색마다 Directory key가 바뀌어 입력 DOM 재생성 가능 | 이름+역할을 우선, 세부 필터 접기, 결과 요약 가까이. 검색 제출 또는 초점 보존 자동 검색 정책을 결정하고 연속 한글 입력/Back 회귀 검증 | 1–2d |
| UX-07 / P1 | [375 상세](qa/phase2/375-detail.png), [extra 응답](qa/phase2/extra-evidence.json), 홈/탐색 | 같은 A-01 최근 10출전 점수: 홈 46.7801, 상세 45.8396(표시 46.8 vs 45.8). 같은 모델명/시점에도 차이 설명 없음. 원인은 아직 확정하지 않음 | 저장된 홈 projection과 실시간 상세 계산의 동일 입력·버전·릴리스 대조를 선행. 임의로 점수를 맞추지 않음. 동일 scope 결과 일치 회귀테스트가 진입 조건 | 0.5–1d 조사 + 수정 별도 |
| UX-08 / P2 | 상세 [375](qa/phase2/375-detail.png), [선발](qa/phase2/375-pitcher.png) | N/A OPS가 첫 카드. 기세는 카드 뒤. `sample reliability`, `medium`, `ready`와 구현용 버전 텍스트가 본문에 노출. 요청 전반 loading/실패로 상세 전체 교체 | 기세/표본/기준일 요약 우선, 결측 원인 짧게, 정상 지표 먼저, 세부 산식 접기. 모델 ID 원문은 출처 상세에 보존하고 상태는 한국어 표시 | 0.5–1d |
| UX-09 / P1 | 랭킹 [320](qa/phase2/320-rankings.png) | revision 0에서 설명 장문 다음 ‘기록 미갱신’과 빈 3보드·각 1/1 표시. 홈 점수는 보이는데 랭킹이 빈 이유를 연결해주지 않음 | 상단 ‘게시된 랭킹 없음 / 홈은 fixture 분석’ 안내+‘선수 탐색’ CTA, 빈 보드 페이지 수 제거. 순위 데이터 생성으로 해결하지 않음 | 4–6h |
| UX-10 / P1 | [탐색 다크](qa/phase2/375-players-dark.png), globals.css `.directory-filters` | 탐색·랭킹 입력 글자가 `var(--foreground,#172b25)`, 배경은 dark surface. --foreground 미정의로 대비 1.05:1(axe serious, 요구 4.5:1) | 기존 --ink 토큰 사용 제안, 라이트/다크 input/select/disabled/포커스 대비 각각 측정 | 2–4h |
| UX-11 / P2 | 상세/비교/홈, [크기 측정](qa/phase2/evidence.json) | 비교 폼 버튼·선택 링크, 상세 작업 링크, 홈 summary 등 44px 미만 대상. 전역 3px outline은 있으나 작은 링크가 조밀함 | 주요 CTA/선택 해제 44×44 및 간격 확보, sticky DEMO·하단 메뉴에 가려지지 않는 scroll-margin·초점 검수 | 4–6h |
| UX-12 / P2 | [로딩](qa/phase2/375-players-loading.png), [오류](qa/phase2/375-players-error.png), 상세 소스 | 홈/상세 초기 로딩은 텍스트, 탐색은 큰 직사각형 skeleton. 상세 fetch에 15초 timeout 없음. 동일 골격·busy 표시 일관성 부족 | 레이아웃 유지 skeleton+단일 status, 입력 유지·오류 원인별 복구, 상세 timeout/취소 회귀 확인. 섹션 실패 독립화는 추가 설계 | 1d |
| UX-13 / P2 | [탐색 빈 결과](qa/phase2/375-players-empty.png), [비교 빈 결과](qa/phase2/375-compare-empty.png), [잘못된 조건](qa/phase2/375-players-invalid.png) | 탐색 빈 결과에는 변경 안내만 있고 초기화가 멀리 위에 있음. 잘못된 URL에도 동일 ‘다시 시도’가 있어 수정 없이 반복 | empty 안에 초기화/검색 수정, invalid에는 기본 조건 링크. 재시도는 같은 요청의 일시적 실패일 때 사용 | 3–5h |
| UX-14 / P2 | 랭킹 소스 `overflowX:auto` wrapper, [랭킹 캡처](qa/phase2/375-rankings.png) | 정상 랭킹 표 wrapper에 이름/명시 tabIndex/스크롤 안내가 없음. 실제 행은 미게시라 미검수 | 공통 DataTable 수준의 region 이름·키보드 스크롤/안내 적용 제안. 정상 게시 fixture 승인 후 모바일 실제 행 검수 필수 | 3–5h + fixture 준비 |
| UX-15 / P3 | [UI_SYSTEM](UI_SYSTEM.md), [SCREEN_SPECS](SCREEN_SPECS.md) | ‘앱 부재·캡처 없음·모델 pending’ 등의 과거 상태와 현재 구현/후속 ADR가 혼재. 예: 모바일 비교 구조·검색 제출·정렬 항목 | 이 감사의 현행 표와 후속 ADR를 기준으로 명세 갱신 제안. 이번에는 기존 문서를 덮어쓰지 않음 | 3–5h |

P0로 단정한 관측은 없다. UX-07은 수치 해석 신뢰 문제라 시각 정리보다 먼저 조사한다. 이번 감사에서 R10 게시 차단 경계를 해제하거나 모델을 바꾸지 않는다.

## 5. 정보구조·핵심 CTA 및 개선 와이어프레임 (제안)

현재 메뉴는 대시보드 / 선수 탐색 / 1군·데이터 시점 / 기세 랭킹 / 선수 비교 / 소개다. ‘검색’과 ‘탐색’, ‘대시보드’와 ‘홈’ 이름을 통일하고, 사용자 목표인 찾기→읽기→비교를 주 흐름으로 제안한다. 게시·권리·산식은 보조 경로로 유지한다. 해당 구조는 **제안이며 ADR 채택/구현 없음**.

| 화면 | 첫 판단에 필요한 정보 | 주 CTA | 보조 CTA |
| --- | --- | --- | --- |
| 홈 | DEMO, 목적, 현재 역할·N·기준일 | 전체 선수 찾기 | 현재 역할 점수 보기 / 산식·출처 |
| 탐색 | 검색어·적용 조건·결과 수 | 선수 상세 보기 | 세부 필터 / 조건 초기화 |
| 상세 | 선수·역할, DEMO·시점, 기세 상태·표본 | 이 조건으로 비교 | 검색 결과로 복귀 / 기록·원천 |
| 비교 0/1명 | 선택 슬롯과 비교 가능 조건 | 첫/두 번째 선수 선택 | 조건 변경 / 제거 |
| 비교 2명 | 동일 조건/역할 여부, 지표별 두 값 | 선수 교체 | 원천·모델 설명 / 선택 초기화 |
| 랭킹 | 게시 여부·기준일·모델·적격 조건 | 유효 행 상세 / 미게시 시 선수 탐색 | 필터·제외 사유 |

### 모바일 320–430px

```text
[서비스명]                  [테마]
[DEMO · 가상 데이터] ← 고정 안내 유지
[화면 제목] [2026 정규 · 기준일]

홈:   [역할] [최근 N출전] [전체 선수 찾기]
      [기세 점수 카드 / 표본·출처] [산식]
탐색: [선수명 검색            검색]
      [역할] [필터 3개 적용 ▾] [초기화]
      [결과 n명 / 조건 요약 / 진행 상태]
      [선수 / 역할 / 핵심지표 / DEMO]
      [이전]       1/7       [다음]
상세: [검색 결과로] [선수·역할]
      [기세 상태 / 표본 / N / 기준일]
      [비교에 추가] [기간 선택]
      [정상 통계] [결측 원인 ▾]
      [차트 ↔ 대체 표] [원천 ▾]
비교: [선수 A] [선수 B 선택/교체]
      [공통 조건 / 비교 불가 시 원인]
      지표        A        B
      ERA       값       값
      표본      값       값
      [DEMO / 출처 / 각 기간 / 모델 ▾]
랭킹: [게시 없음 안내 + 선수 탐색]
      또는 [조건 ▾] [타자/선발/불펜]
      [선수·순위/점수/표본/시점/출처]

[홈] [선수 탐색] [비교] [랭킹]
```

빈 슬롯에서 선수명을 입력하면 제한된 결과와 역할이 보이고 선택 후 슬롯으로 초점을 돌린다. 검색 패널이 dialog라면 label/초점 trap/Escape/복귀를 갖추고, 인라인이면 강제 trap을 만들지 않는다. 서로 다른 역할은 현재 계약대로 값 분리·우열 비교 제외, 동일 선수/3슬롯 오류도 숨기지 않는다.

### 768 / 1440px

768px에서는 필터가 본문을 지나치게 좁히지 않도록 상단 2열 필터, 상세 1열 요약을 우선 검토한다. 1440px에서는 최대 1200px 본문과 여유 간격을 유지하고, 탐색 필터/결과 분리 및 비교 지표명+A+B 정렬 구조를 제안한다. 원천 ID·긴 modelVersion은 줄바꿈하고 필요 시 details에서 제공한다. 출처와 DEMO/as-of 자체는 접지 않는다. 사진 대신 기존 중립 도형/텍스트 이니셜을 사용한다.

## 6. 반응형·접근성 검수

- 지정 5폭 × 5화면 25개 캡처에서 `documentElement.scrollWidth <= innerWidth` 확인. 추가 6개 상태도 수평 넘침 없음([측정](qa/phase2/evidence.json)). ‘넘침 없음’이 ‘읽기 쉬움’을 뜻하지는 않는다. 비교는 세로 왕복, 탐색은 긴 필터가 남는다.
- 320: 메뉴 줄바꿈, 검색 1열, 비교 1열, 상세 기간 탭 줄바꿈. 375/430: 같은 모바일 구조, 하단 nav 4개. 768: 하단 nav 숨김, 상단 메뉴·홈 2열·비교 2열. 1440: 홈 3열 카드·우측 검색, 탐색 여러 열·비교 2열. 200% 브라우저 확대 및 실기기 pinch 확대는 미실행.
- 전역 `:focus-visible` 3px/offset 5px, skip link, `main#main`, 현재 메뉴 aria-current, 한국어 lang, form label, reduced-motion CSS, 상세 차트 대체 표와 원천 참조는 소스에서 확인. 실제 첫 Tab 초점 캡처는 [키보드](qa/phase2/375-keyboard.png).
- 홈 역할은 Radix tabs, 상세 차트는 Enter/Space로 표 행 이동, 공통 표는 이름 있는 키보드 스크롤 region을 제공한다. 랭킹 표는 공통 컴포넌트와 달라 UX-14로 구분한다.
- axe 라이트/다크 375px 5경로 결과는 interaction.json을 기준으로 한다. 자동 검사가 통과해도 수동 스크린리더·전 흐름 키보드·200% 확대·실기기까지 통과했다는 뜻은 아니다. 검사 중 페이지 전환 오류는 접근성 위반과 별도 집계한다.
- WCAG 텍스트 대비 4.5:1, 큰 텍스트/비텍스트 UI 3:1, 프로젝트 터치 영역 44×44를 목표로 한다. 작은 대상 측정은 bounding box 높이 탐지이므로 주변 여유 영역을 고려한 WCAG 최종 적합 판정은 아니다. 다크 입력 대비 UX-10을 우선 해결한다.

## 7. 스켈레톤·오류·빈 데이터·오프라인

| 화면/상태 | 재현·증거 | 현행과 개선 확인점 |
| --- | --- | --- |
| 탐색 loading | `/players`, `/api/v1/player-directory*` 응답 4초 지연, [캡처](qa/phase2/375-players-loading.png) | 텍스트+큰 skeleton. 결과 카드 높이·busy·입력 초점 유지 검토 |
| 탐색 error | 같은 API를 HTTP 503 `{error:'UX 감사용 연결 오류'}`로 응답, [캡처](qa/phase2/375-players-error.png) | role=alert와 다시 시도 있음. mock 오류이며 실제 장애 아님 |
| 탐색 empty | `/players?q=없는선수`, [캡처](qa/phase2/375-players-empty.png) | 0명과 자료 없음 구분 문구 있음. 인라인 초기화 제안 |
| invalid | `/players?season=2025`, [캡처](qa/phase2/375-players-invalid.png) | 명시 오류, 초기화 위쪽. invalid 재시도 정책 개선 |
| 비교 empty | `/compare?q=없는선수`, [캡처](qa/phase2/375-compare-empty.png) | 두 슬롯 ‘선택 필요’와 결과 없음. 다음 행동 CTA 필요 |
| 랭킹 empty | `/rankings?season=2025`, [캡처](qa/phase2/375-rankings-empty.png) | 미지원 시즌을 다른 시즌 점수로 대체하지 않음. 기본 시즌 복구 CTA 검토 |
| 상세 partial | `/players/demo_0_00`, [캡처](qa/phase2/375-detail.png) | OPS/OBP N/A·원천 결측 원인, AVG=0과 구분. 0을 자료 없음으로 처리하지 않음 |
| 홈/상세 loading/error | 컴포넌트의 status/재시도와 E2E 확인 | 이번 별도 주입 캡처는 탐색에 한정. 상세 15초 timeout은 미구현, 섹션 독립 복구는 제안 |
| 오프라인 | context.setOffline(true), [캡처](qa/phase2/1440-offline.png) | 공통 안내 있음. 현재 DOM 수치는 남고 추가 조회 차단은 일괄 적용되지 않음. 캡처는 1440×900 PC viewport |

Playwright 주입 재현 예시(브라우저 문서/데이터를 변경하지 않고 해당 context 요청만 mock):

```js
await page.route('**/api/v1/player-directory*', route =>
  route.fulfill({status:503, json:{error:'UX 감사용 연결 오류'}}));
await page.goto('http://127.0.0.1:3107/players');
await page.getByRole('alert').waitFor();
await page.screenshot({path:'/tmp/375-players-error.png', fullPage:true});
await page.unroute('**/api/v1/player-directory*');
// 로딩은 route handler에서 4초 지연한 뒤 continue; 지연 중 status/skeleton 캡처.
```

## 8. DEMO·출처·표본 검수

| 항목 | 확인 | 남은 문제 |
| --- | --- | --- |
| 전역 DEMO | 25개 기본 캡처 모두 DEMO 있음, sticky 안내 유지 | 독립 카드가 캡처/복사될 때 자체 DEMO 유지 필요. 홈·탐색은 카드에 있음 |
| 출처/as-of | 홈 상태·탐색 결과 상단·상세/비교 footer | 상세·비교는 수치에서 멀고 긴 패널 아래. 각 요약 가까이 축약 출처/기준일 제안 |
| 시즌/대회 | 홈/상세/비교/랭킹 표시, 탐색 2026 정규 DEMO만 지원 | 영어 enum/내부 ID가 사용자 문장에 남음. 화면 라벨만 번역, 원천 값 보존 |
| 표본/신뢰도 | 홈 출전 수·신뢰도, 탐색 기록 표본과 전체 기세 구분 도움말, 상세 PA/BF/outs, 비교 각 표본 | 표본의 단위와 최소 요건을 가까이. 선발·불펜 ‘경기’는 역할 등판과 구분, 낮은 신뢰도를 예측 정확도로 쓰지 않음 |
| 미출전/결측 | N/A·필수 원시 기록 결측, 등록 미확인, 휴식/결장 사유 미확인 | 근거 없는 컨디션/부상/1군 상태 추정 금지, 빈 값 0으로 대체 금지 |
| 모델/변화 | 상세 버전·내부 이동 창 근거, 랭킹 이전 게시 비교 설명 | 홈 ‘상승세’ 용어 UX-02, 화면별 점수 차이 UX-07. 원본 해시/출처를 지우지 않고 일치성 조사 |
| REAL 분리 | 현재 DEMO 및 가상 이름/샘플 팀·중립 도형 | 실제 데이터/로고/사진 도입은 권리·출처·표시 범위 승인 후 별도 단계. 사용자 모드 토글 신설 안 함 |

## 9. 검증 실행 결과

| 순서 / 명령 | 실제 결과 |
| --- | --- |
| `pnpm test` | exit 0, 28파일 / 267 passed / 1 skipped (PERFORMANCE=1 전용 벤치). 12.60초 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 pnpm test:e2e --workers=1` | exit 1, **33 passed / 2 failed**, 3.6분. API timeout 20초 내 alert 부재, 비교 axe 실행 context 소멸 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 pnpm test:e2e tests/e2e/api.spec.ts tests/e2e/compare.spec.ts --grep 'API timeout\|pitching units' --workers=1` | 실패 2건 분리 재실행 exit 0, 2 passed, 22.7초. 최초 실패를 삭제하거나 전체 35/35 성공으로 합산하지 않음 |
| `pnpm typecheck` | exit 0, route typegen + tsc 성공 |
| `pnpm lint` | exit 0, `eslint . --max-warnings=0` 성공 |
| `pnpm build` | exit 0, webpack production compile·TypeScript·22개 정적 페이지 생성 성공 |
| 신규 캡처/axe/흐름 검사 | 31개 상태 측정에서 넘침 0. 별도 375px 라이트 5경로 axe 위반 0; 다크 5경로 중 탐색/랭킹 color-contrast serious, 나머지 3경로 위반 0. 최초 캡처 스크립트는 axe 도중 페이지 전환 오류로 중단되어 접근성/흐름을 별도 재실행함 |

최초 E2E/axe 실패 시 dev 서버 로그에 Fast Refresh full reload가 있었다. 재실행 통과는 일시적 환경 영향 가능성을 지지하지만 타임아웃 실패의 원인을 확정하지 않는다. E2E 실행 당시 별도 캡처 context도 있었으며 부하/개발 서버 영향을 배제하지 않는다. production 전체 E2E는 미실행이다. 캡처와 E2E 종료 후 dev 서버를 종료하고 build를 실행해 .next 동시 쓰기를 피했다. Next 실행이 생성한 next-env.d.ts의 경로 변경은 시작 시 깨끗했던 HEAD 내용으로 복원했다. typecheck/build 성공은 실행 당시 생성 경로 기준이며, 복원 후 앱 검사를 반복하지 않았다.

기존 E2E 중 반응형·접근성 5폭, dialog 키보드/Escape, 오프라인, 한글 조합, 오류 재시도, 차트→표 행 이동 등이 통과했다. 이 결과가 사용자 전체 키보드/스크린리더 수동 검증을 대체하지 않는다. 관리자 E2E·SQL 마이그레이션·운영 연결·성능 전용 벤치는 이번 문서 감사 범위에서 미실행이다. 보조 contact sheet 생성은 로컬 Python Pillow 미설치로 실패했고 설치하지 않았다. 개별 PNG를 직접 열어 확인했다.

문서 검증: 상대 링크 대상 존재, 지정 25개 조합·폭, 31개 측정의 가로 넘침 0, PNG 44개와 JSON 파싱을 확인했다. [캡처 manifest](qa/phase2/manifest.json)에 픽셀 크기·SHA-256을 보존한다. 이는 앱 테스트와 별개다.

## 10. 다음 단계 체크리스트·되돌리기

- [x] 현재 브랜치/커밋/기존 변경 확인, feature 브랜치 생성.
- [x] 요청 경로/컴포넌트/명세 분석, 320·375·430·768·1440 화면 신규 캡처.
- [x] 핵심 흐름과 기능별 UX 우선순위를 경로·캡처에 연결.
- [x] 개선 IA/CTA/와이어프레임은 제안 상태로 기록. 앱·계약·데이터 수정 없음.
- [ ] UX-07 동일 모델/시점 점수 차이 조사 및 반복 검증, UX-10 다크 대비 수정 승인.
- [ ] UX-01/04/05/06의 범위 확정 후 구현. 조회 조건/URL 계약 변경은 ADR·마이그레이션·회귀 테스트 포함.
- [ ] 승인된 합성 게시 fixture를 **기존 파일을 덮어쓰지 않는 별도 환경**에 준비하고 정상 랭킹→스냅샷 상세→비교 복귀 검수. 현행 revision 0에서 그 흐름은 미검증.
- [ ] VoiceOver 등 수동 스크린리더, 전체 키보드, 200% 확대, iOS/Android 실기기, 낮은 네트워크 검수.
- [ ] E2E 실패 원인 분리와 통과 증거 확보. 자동 배포나 main push 없이 리뷰.

이번 감사의 수락 근거는 위 결함별 재현 경로/스크린샷 연결이다. 제품 개선 완료나 출시 수락을 뜻하지 않는다. 변경 파일은 이 문서와 `docs/qa/phase2/`의 새 PNG/JSON뿐이다. 되돌리려면 **이번에 추가한 이 문서와 phase2 폴더만** 제거한다. 기존 `docs/qa`나 시작 전에 있던 변경에는 reset/clean을 적용하지 않는다. Git 커밋·push·main 변경·배포는 수행하지 않았다.
