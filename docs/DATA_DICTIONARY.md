# 데이터 사전 v1

기준일: 2026-11-03 (Asia/Seoul). 상태: ADR-009의 **채택된 구현 계약**, 구현·DB migration·fixture 검증은 미실행. [API](API_CONTRACT.md), [화면](SCREEN_SPECS.md), [아키텍처](ARCHITECTURE.md), [권리 대장](DATA_RIGHTS.md)를 함께 적용한다. 실제 데이터 권한은 없으며 현재 모드는 DEMO다. 이 계약은 외부 공급자 스키마가 아니다.

## 1. 공통 타입·출처·결측

내부 저장 필드는 snake_case, 공개 JSON은 표에 대응하는 camelCase로 명시적으로 변환한다(예: player_id → playerId, outs_recorded → outsRecorded, PA → pa). ORM 행을 그대로 반환하지 않는다.

| 타입/표기 | unit·범위·nullability·없는 값 처리 |
| --- | --- |
| ID | 단위 없음, ASCII `[a-z][a-z0-9_-]{0,63}`, 대소문자 구분, 생성 후 불변·재사용 금지, NOT NULL. 실제와 가상 namespace 분리; DEMO는 `demo_` 접두사 필수. 공개 release ID도 이 문법 사용 |
| Text(k) | NFC Unicode, 앞뒤 공백 제거 후 1~k code point, NOT NULL. 빈 문자열 거부 |
| Date | 유효한 ISO `YYYY-MM-DD`, NOT NULL; 경기·효력일은 Asia/Seoul 달력 날짜 |
| Instant | RFC3339 UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, NOT NULL; 입력 offset은 UTC로 정규화. 시간 정밀도 ms; unknown 시간을 자정으로 날조하지 않음 |
| Count / Count? | 사건 개수, 정수 0~2,147,483,647. `?`만 nullable. 알려진 0은 0, 미제공/불명은 null. 음수·소수·빈 문자열·NaN·Infinity·숫자 문자열 거부. 범위 상한은 저장 안전 한도이며 야구의 현실성 보증 아님 |
| Bool | true/false, NOT NULL; 0/1 coercion 금지 |
| nullable | 표의 `?`만 null 허용. 필드는 항상 존재하며 생략 불가. nullable 아닌 필수값 누락은 행/배치 거부. 최상위/중첩 객체의 미정의 필드도 거부. null 허용 필드도 원인 추적 필수 |
| Rate? | 단위는 각 수식 참조; 유한 비음수 JSON number 또는 null. 합산한 정수 분자/분모에서 계산. 저장/정렬은 반올림 전 값, 표시만 반올림 |

모든 버전 행은 다음 `P` 필드를 상속한다. 아래 엔티티 표에서 `P`는 중복 기재하지 않는다.

| P 필드 | 타입·unit·범위·null | source·처리 |
| --- | --- | --- |
| batch_id | ID, 필수 | import_batch FK. source 데이터는 동일 배치에 한정 |
| source_id | ID, 필수 | 권리 대장 출처 ID를 내부 ID로 매핑한 값. `D-SYNTHETIC` → `demo_source_synthetic` (공개 sourceId). 외부 문자열을 임의로 source로 등록 금지 |
| rights_record_id | ID, 필수 | source_license의 특정 불변 버전 FK. source_id와 일치 |
| as_of | Instant, 필수 | 공급/fixture가 보장하는 데이터 기준 시각. imported_at·현재 시각으로 대체 금지. 행 as_of ≤ 배치 as_of |
| source_record_key | Text(200), 필수 | 공급자 키 또는 fixture 제작 키. 공급자 변경 시에도 논리 ID와 분리; 내부 전용 |
| missing_fields | map, 필수(기본 `{}`) | nullable 값마다 필드명 → `not_provided`/`unknown`/`not_applicable`. null과 1:1 대응; 비null의 원인 표기 거부 |

source는 표의 `입력`(승인된 fixture/향후 승인 공급), `관리`(서버 검증된 메타데이터), `파생`(명시한 계산)으로 구분한다. 파생 결과도 입력 행 키·batch·source·rights·as_of를 보존한다. 행을 가공했다는 이유로 원천 권리를 제거하지 않는다. 수치별 `metricSources`는 원천 sourceId 목록, 결측 행 수, 단위를 반환한다.

## 2. ID·키와 관계

- **player_id는 전역 유일한 사람 식별자**다. 이름·등번호·소속팀·시즌과 독립이며 개명·이적·동명이인·등번호 변경으로 바뀌지 않는다. 이름으로 merge하지 않는다. 외부 ID mapping은 검증된 관리자 경계에서만 관리하며 불확실한 동일인 병합은 게시 거부한다.
- team/player/game의 논리 ID는 배치 밖에서도 안정적이다. 실제 행 PK는 `(batch_id, 논리 ID)`. 모든 FK는 batch_id도 포함한다. 한 release의 팀·선수·경기·등록·기록은 한 배치만 참조한다.
- 배치는 **한 시즌·한 대회·한 mode의 완전 스냅샷**이다. 이 문서의 season/competition은 차원 정의이며 배치의 season_id/competition_id FK와 일치한다. 정규시즌과 포스트시즌 합계·랭킹·점수를 섞지 않는다.
- `releaseId`는 아키텍처의 Release(배치 + 계산 실행 묶음), `revision`은 scope별 양의 증가 정수다. 복구도 새 release/revision으로 게시하며 기존 행을 수정하지 않는다. 기존 모델 미확정 release는 점수 없이 통계만 제공할 수 있다.

## 3. 엔티티

각 표의 `입력`은 현재 자체 가상 fixture만 허용한다. `?`가 없는 필드는 필수다.

### team

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| team_id | ID | 관리; 안정 팀 ID. 이름 변경으로 교체 금지 |
| name | Text(100) | 입력; 가상 팀 표시명 |
| short_name | Text(20) | 입력; 텍스트 대체, 로고 권한 추정 금지 |

P 상속. PK `(batch_id, team_id)`. 선수 소속은 player에 현재 팀 하나로 고정하지 않고 등록·출전별로 조회한다.

### player

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| player_id | ID | 관리; 이름/등번호/팀과 분리한 전역 유일 ID |
| display_name | Text(100) | 입력; 중복 허용, 정렬키는 NFC 이름의 Unicode code point 오름차순 |
| listed_roles | 중복 없는 enum 배열 0~3개 | 입력; batter/starter/reliever. 소개용이며 출전 role·모델 role 판정에 사용 금지 |

P 상속. PK `(batch_id, player_id)`. 주민번호·연락처·불필요한 생년월일·사진 URL은 수집/공개하지 않는다. 등번호는 아래 등록 시점의 값이며 ID가 아니다.

### season

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| season_id | ID | 관리; 연도와 별개의 FK |
| year | 정수, 년, 1900~9999 | 입력; 경기 timestamp에서 추론 금지 |
| label | Text(100) | 입력 |
| starts_on / ends_on | Date | 입력; 시작 ≤ 종료. 개별 경기의 original_date/played_on은 범위 안이어야 함 |

P 상속. PK `(batch_id, season_id)`; 배치에 정확히 1개. 연도는 한 배치에서 유일.

### competition

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| competition_id | ID | 관리 |
| kind | regular / postseason | 입력; 다른 종류는 v1 거부 |
| label | Text(100) | 입력; 정규시즌/포스트시즌 표시 |

P 상속. PK `(batch_id, competition_id)`; 배치에 정확히 1개. kind는 API `competition`과 동일.

### game

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| game_id | ID | 관리; 취소·재개·정정에도 같은 논리 경기면 유지 |
| season_id / competition_id | ID | 입력; 배치 scope와 동일 |
| home_team_id / away_team_id | ID | 입력; 서로 달라야 함 |
| original_date | Date | 입력; 최초 편성 날짜, 기록 정렬에 사용하지 않음 |
| played_on | Date? | 입력; 실제 첫 플레이 날짜, 미시작이면 null |
| started_at | Instant? | 입력; 실제 시작 시각, 미제공이면 null |
| completed_at | Instant? | 입력; 확정 완료 시각. final은 필수, 그 외 null |
| doubleheader_no | 정수 0~2, 회차 | 입력; 일반 0, 더블헤더 1/2. 각 경기 별도 game_id |
| status | scheduled / in_progress / suspended / final / cancelled / void | 입력; 아래 처리표 적용 |
| record_revision | 정수 1~2,147,483,647, 판 | 관리; 같은 game_id 정정 시 증가 |
| supersedes_batch_id | ID? | 관리; 정정/상태 변경의 직전 배치 참조, 최초 null. 원천 기록 유지 |

P 상속. final일 때 played_on/completed_at은 모두 필수이며 played_on ≤ completed_at의 KST 날짜, started_at이 있으면 started_at ≤ completed_at ≤ 배치 as_of. 경기 중 누적 수치는 공개 시즌 합계·최근 구간에 넣지 않는다.

### player_game_batting

P와 다음 필드 상속. PK `(batch_id, game_id, player_id)`; 같은 선수의 한 경기 모든 타석을 한 행으로 합친다. 수비/대주자 출전도 입력이 확인되면 PA=0 행을 허용하며 **출전 1경기**로 센다. 경기 출전 사실을 roster에서 추론하지 않는다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| game_id / player_id / team_id | ID | 입력; 팀은 해당 경기 홈/원정 중 하나, 출전 당시 귀속 |
| role | batter | 관리; 투수 모델과 분리. 투타 겸업은 타격/투구 각각 존재 가능 |
| PA | Count?; 타석 | 입력; 0 포함, 미제공 null |
| AB | Count?; 타수 | 입력 |
| H | Count?; 안타 | 입력; 단타+2B+3B+HR |
| 2B | Count?; 2루타 | 입력; JSON `doubles` |
| 3B | Count?; 3루타 | 입력; JSON `triples` |
| HR | Count?; 홈런 | 입력 |
| BB | Count?; 볼넷 | 입력; IBB 포함 |
| HBP | Count?; 몸에 맞는 공 | 입력 |
| IBB | Count?; 고의볼넷 | 입력; BB의 부분집합, BB에 다시 더하지 않음 |
| SO | Count?; 삼진 | 입력 |
| SF | Count?; 희생플라이 | 입력 |
| SAC | Count?; 희생번트 | 입력; SF와 구분 |
| R | Count?; 득점 | 입력 |
| RBI | Count?; 타점 | 입력 |
| SB | Count?; 도루 | 입력 |
| CS | Count?; 도루실패 | 입력 |
| TB | Count?; 총루타 | 파생; H/2B/3B/HR 모두 있을 때 `H+2B+2×3B+3×HR`, 아니면 null. 입력 TB가 있으면 계산과 일치해야 함 |

알려진 값에 한해 `H≤AB≤PA`, `2B+3B+HR≤H`, `SO≤AB`, `IBB≤BB`, `PA≥AB+BB+HBP+SF+SAC` 검사. PA의 나머지는 타격방해 등 별도 사건 가능하므로 등식을 강제하거나 누락 필드를 차액으로 채우지 않는다. 부분합도 알려진 항만 합쳐 상한을 검사한다. TB는 공급값과 계산 불일치 시 배치 거부. R/RBI/SB/CS를 AB에 종속시키지 않는다.

### player_game_pitching

P 상속, PK `(batch_id, game_id, player_id)`. 동일 경기 재개 후 투구도 한 행에 누적하며 두 번 등판으로 세지 않는다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| game_id / player_id / team_id | ID | 입력; 같은 배치 FK, 경기 당시 팀 |
| role | starter / reliever | 입력; 해당 출전의 role, 시즌 주역할로 덮어쓰지 않음 |
| BF | Count?; 상대 타자 | 입력 |
| outs_recorded | Count?; 아웃 (1아웃=1) | 입력; 0 허용. 1.1 같은 이닝 소수 저장 금지. `floor(outs/3)`와 나머지로 표시 |
| H | Count?; 피안타 | 입력 |
| ER | Count?; 자책점 | 입력; ER≤R |
| R | Count?; 실점 | 입력 |
| BB | Count?; 볼넷 | 입력; IBB 포함 |
| IBB | Count?; 고의볼넷 | 입력; IBB≤BB |
| HBP | Count?; 몸에 맞힌 공 | 입력 |
| SO | Count?; 탈삼진 | 입력; 알려진 BF보다 클 수 없음 |
| HR | Count?; 피홈런 | 입력; HR≤H |
| NP | Count?; 투구 수 | 입력; 제공되는 경우만 값, 없으면 null. BF에서 추정 금지 |
| GS | 정수 0/1; 선발 여부, 필수 | 입력; 1이면 starter, 0이면 reliever. 둘 불일치/미확인은 게시 거부 |
| SV | 정수 0/1?; 세이브 | 입력; 미제공 null |
| HLD | 정수 0/1?; 홀드 | 입력; 미제공 null |

알려진 값에 한해 `H+BB+HBP≤BF`, `SO≤BF`, `HR≤H`, `ER≤R`, `IBB≤BB`, `GS+SV≤1`, `GS+HLD≤1`, `SV+HLD≤1`. 상속 주자·수비 실책·주루 아웃 때문에 BF=outs+출루 등식을 강제하지 않는다. 투구 0아웃 등판은 실제 등판 1회이며 비율 분모 0이면 null. 시즌 전체 GS/구원 횟수는 행별로 계산한다.

### roster_snapshot

P 상속. PK `(batch_id, snapshot_on, player_id)`. 같은 기준일에 한 선수 하나의 상태만 허용한다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| player_id | ID | 입력 |
| snapshot_on | Date | 입력; 관측 기준 날짜 ≤ 배치 as_of의 KST 날짜 |
| effective_on | Date? | 입력; 확인된 효력일 ≤ snapshot_on, 모르면 null |
| status | registered / unregistered / unknown | 입력; 1군 등록 기준, unknown을 unregistered로 치환 금지 |
| team_id | ID? | 입력; registered면 필수, 그 외 모르면 null |
| uniform_number | Text(8)? | 입력; 당시 등번호, 문자열 `00` 허용. ID나 정렬 기준 아님 |

요청 기준일 이하의 가장 최신 snapshot을 사용한다. 행이 없으면 API는 status=unknown, snapshotOn/teamId/uniformNumber=null을 합성하고 `roster_snapshot_missing`을 표기한다. 등록 정보는 시즌 단위 사실이며 대회별 배치에 복제할 때 출처/관측일을 유지한다. 이전 관측을 오늘의 확정 등록으로 표현하지 않는다. 소속 이력은 관측/출전 사실로만 표시하고 관측 사이의 연속 소속·부상·말소 이유를 추정하지 않는다.

### import_batch

P를 상속하지 않는 루트. 완전 스냅샷은 불변이며 상태 전이/게시 이력은 별도 감사로 보존한다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| batch_id / source_id / rights_record_id | ID | 관리; 배치당 소스/권리 버전 1개. 다중 소스는 v1 수입 거부 |
| season_id / competition_id | ID | 관리; 동일 배치 차원 FK |
| schema_version | `1.0.0` | 관리; 알 수 없는 버전 거부, 자동 추측 변환 금지 |
| mode | DEMO / APPROVED | 관리; 요청자가 바꾸지 못함, 현재 DEMO만 |
| as_of | Instant | 입력; 데이터 보장 기준일 |
| imported_at | Instant | 관리; 서버 수입 완료 시각, as_of≤imported_at |
| last_successful_sync_at | Instant? | 관리; 해당 소스/scope의 검증·원자 게시 성공 시각. 게시 전 null, 실패한 시도는 갱신 금지. DEMO는 fixture 게시 시각이며 외부 동기화 아님 |
| raw_hash / canonical_hash | 소문자 SHA-256 hex 64자 | 관리; 원본/정규화 완전 내용 해시, 공개 응답 제외 |
| adapter_version | Text(64) | 관리; fixture adapter 버전 |
| status | staged / validated / rejected | 관리; rejected/미검증 배치 공개 금지. 게시 여부는 release 이력에서 파생 |
| validation_report_ref | ID? | 관리; 검증 전 null, validated/rejected면 필수. 내부 전용 |

중복키는 `(source_id, mode, season_id, competition_id, schema_version, canonical_hash)`. 증분·정정은 기존 행 덮어쓰기 대신 새 완전 배치 생성·검증·원자 게시. 최대 UTF-8 입력 5 MiB(5×1024² bytes), 엔티티 총 50,000행(중첩 통계 행 포함). 초과는 거부하고 조용한 절삭 금지.

### source_license

아키텍처의 Source/RightsRecord를 한 사전 항목으로 기술한다. PK rights_record_id, source_id별 버전 불변. 현재 권리 상태는 요청 시 별도 재확인하여 과거 승인 버전으로 철회를 우회하지 못한다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| rights_record_id / source_id | ID | 관리; 특정 권리 버전/출처 |
| version | 양의 정수 | 관리; source별 증가 |
| public_name / attribution | Text(200) / Text(1000) | 관리; 공개 허용 출처명·표시문 |
| public_url | https URL? (최대 2048자) | 관리; 공개 안전 링크만, 미제공 null |
| mode | DEMO / APPROVED | 관리; 가상과 실제 혼합 금지 |
| status | pending / approved / rejected / expired / revoked | 관리; approved 외 기본 거부 |
| collection / storage / derivation / publication | Bool 각 1개 | 관리; 독립 권한, 모두 true 및 scope 일치해야 해당 파이프라인 허용 |
| allowed_fields | 고유 Text(64) 배열, 1~200개 | 관리; 공개 원본·파생 필드 allowlist, wildcard 금지 |
| allowed_seasons / allowed_competitions | ID 배열 각 1개 이상 | 관리; 범위 밖 입력/노출 거부 |
| effective_at / expires_at | Instant / Instant? | 관리; 시작 포함·만료 제외. null 만료는 명시적 무기한 승인에만 허용 |
| revoked_at | Instant? | 관리; revoked면 필수, 이후 읽기/캐시/복구도 차단 |
| evidence_ref / review_ref | ID 각 1개 | 관리; 비공개 증빙·검토 참조, 민감 원문 공개 금지 |

API는 public_name/attribution/public_url, 공개 승인 상태와 ID·mode만 허용한다. 계약·계정·담당자 실명·내부 경로를 반환하지 않는다. DEMO 자체 제작 승인도 실제 사용 승인과 다르다. 대장/게이트를 충족하지 않으면 APPROVED 선택 불가.

### score_version

P 대신 독립 모델 정의. PK score_version_id, 모든 버전 불변. P3 전 채택 모델 행 없음.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| score_version_id | ID | 관리 |
| version | Text(64) | 관리; 재현 가능한 semantic model version |
| status | proposed / adopted / retired | 관리; adopted만 신규 점수 계산 허용 |
| roles | 정확히 batter/starter/reliever 3개 정의 | 관리; 각 role마다 독립 formula_ref, window_n, minimum_sample, normalization_ref, rounding_policy를 필수 포함 |
| formula_ref / normalization_ref | Text(200), 각 role별 | 관리; 버전 고정 명세와 코드 해시 참조, 비어 있으면 채택 금지 |
| window_n | 정수 1~100; 출전/등판 수, role별 | 관리; 제안은 10/5/10, 확정 전 API에서 null |
| minimum_sample | map; role별 | 관리; appearances/pa/bf/outsRecorded의 필요한 항목과 정수 하한 1 이상 명시, 조건은 AND. 필요한 필드 누락이면 채택 금지 |
| rounding_policy | Text(200), role별 | 관리; 저장 정밀도·동점 판단·최종 표시 명시 |
| adopted_at | Instant? | 관리; adopted/retired 필수, proposed null |

점수 범위 0~100은 모델 제안으로 유지한다. 모델 채택 전 window_n/최소 표본/점수/변화/순위를 임의 생성하지 않는다. API의 통계용 최근 N=10/5/10 계약과 모델 계산용 N은 별개며 UI는 각각 명시한다.

### score_snapshot

P 상속. PK score_snapshot_id; UNIQUE `(batch_id, score_version_id, player_id, evaluation_role, team_scope, cutoff_at)`. team_scope는 `all` 또는 team_id이며 SQL NULL unique의 중복 함정을 피한다.

| 필드 | 타입·unit·범위/null | source·규칙 |
| --- | --- | --- |
| score_snapshot_id / player_id / score_version_id | ID | 관리; 배치 선수 및 채택 모델 FK |
| evaluation_role | batter / starter / reliever | 관리; 선발/불펜 평가 role 명시 |
| team_scope | `all` 또는 team_id | 관리; 경기 당시 팀 필터 |
| cutoff_at | Instant | 관리; ≤ 배치 as_of, 이 시각 이후 확정 경기 사용 금지 |
| status | ready / insufficient_sample / missing_data / no_appearances | 파생; 아래 우선순위 적용 |
| value / previous_value / delta | 유한 number?; 점 | 파생; 채택 모델의 범위·정밀도 적용. delta는 음수 가능, 양쪽 ready 및 완전 N일 때만 산출 |
| sample | object | 파생; requestedN, appearances, pa/bf/outsRecorded(비해당 null), missingCounts, 시작/끝·직전 구간·사용 경기 ID를 필수 보존 |
| input_refs | `(batch_id, game_id, player_id, record_revision)` 배열 | 파생; 최근/직전 입력 전부. 공개는 안전한 gameId 목록만 |
| computed_at | Instant | 관리; 계산 완료 시각 ≥ cutoff_at |

모델 미확정이면 snapshot 자체를 생성하지 않고 API status=`model_pending`, scoreVersion/value/delta=null. 확정 후 상태 우선순위: 출전 0 → no_appearances, 필요한 원천 결측 → missing_data, 모델 최소표본 미달 → insufficient_sample, 나머지 ready. 이전 구간 실패는 현재 점수를 없애지 않으며 previousValue/delta=null과 사유를 제공한다.

## 4. 경기 상태·정정·기간

| 상황 | 합계·최근 N·표시 규칙 |
| --- | --- |
| scheduled/in_progress | 확정 전 기록 제외. 예정/진행 중 안내만, 라이브 점수처럼 표현 금지 |
| cancelled | 첫 플레이 전 취소. played_on=null, 출전 행 금지, 표본 제외. 재편성은 새 game_id와 외부 연관 참조로 관리 |
| void | 시작했어도 무효로 확정. 과거 원본 보존, 출전 행은 감사용 보존 가능하나 모든 공개 집계·표본 제외 |
| suspended | 중단 후 미확정, 누적 기록 집계 제외. 재개 시 같은 game_id의 새 revision으로 최종 누적 1행 제공 |
| final | cutoffAt 이하 completed_at인 확정 기록만 포함. 취소/무효를 0기록 경기로 넣지 않음 |
| 더블헤더 | 서로 다른 game_id, 각 1출전/등판. 같은 날 2경기는 2표본, 연속 등판일 계산은 같은 날짜 1일 |
| 정정 | 새 batch·record_revision·release 생성, 이전 release 불변. 새 release에서 합계·최근/직전·파생 점수 전부 재계산; 같은 경기 중복 합산 금지 |

통계 scope는 season+competition+evaluationRole+teamScope+cutoffAt+releaseId다. cutoffAt 생략 시 release 배치 as_of. 미래 cutoffAt은 422. 과거 cutoff은 그때 **완료된 경기만** 선택하지만 해당 release에 반영된 사후 정정은 포함한다. 이를 당시 알려졌던 기록이라고 주장하지 않으며 당시 공개값 재현은 당시 releaseId로 한다.

**최근 N은 달력상 최근 N팀 경기 X, 해당 선수의 최근 N 출전(투수는 평가 role의 등판) O.** 먼저 시즌·대회·팀·role·확정/cutoff 필터를 적용하고 `(completed_at, game_id)` 내림차순으로 N개를 고른다. 같은 시각은 ASCII game_id 오름차순을 tie-break로 고정한다. 투수 starter는 GS=1만, reliever는 GS=0만. opener도 입력 GS=1이면 선발이다. 최근 구간은 미출전일·휴식으로 길어질 수 있다.

직전 구간은 정렬된 출전의 N+1~2N번째이며 겹치지 않는다. 결측 경기를 건너뛰어 더 오래된 기록으로 채우지 않는다. 최근/직전 중 N 미만은 partial window이며 통계는 `availableN/requestedN`, 점수 변화는 비교 불가. 팀별 최근 N과 전체 팀 최근 N은 선택 표본부터 다를 수 있어 각 팀 최근 합계를 더해 전체 최근 합계로 삼지 않는다. 시즌 합계는 팀별 합계의 합과 일치한다.

## 5. 집계·비율·활동 정보

- G는 타격 행 수, 투수 appearances는 평가 role 행 수, GS는 선발 행 합이다. PA=0 또는 outs=0도 출전 포함. 경기 취소/중단은 제외한다.
- 한 지표라도 선택 행에 null이 있으면 그 지표의 합계는 null이다. `knownSubtotal`과 `knownRows/totalRows`는 별도 부분값으로만 제공하고 합계로 표시하지 않는다. 다른 완전한 지표는 유지한다. TB 원천 부족은 missing_data, 0분모는 zero_denominator로 구분한다.
- AVG=ΣH/ΣAB, OBP=(ΣH+ΣBB+ΣHBP)/(ΣAB+ΣBB+ΣHBP+ΣSF), SLG=ΣTB/ΣAB, OPS=OBP+SLG. AVG/OBP는 0~1, SLG는 0~4, OPS는 0~5. 분모 0이면 null. 경기별 비율 평균 금지.
- ERA=27×ΣER/ΣoutsRecorded(자책점/9이닝), WHIP=3×(ΣH+ΣBB)/ΣoutsRecorded(출루/이닝), K/9=27×ΣSO/ΣoutsRecorded, BB/9=27×ΣBB/ΣoutsRecorded. 모두 분모 0이면 null, 상한 인위적 절삭 금지. IBB 이중 가산 금지.
- 표시: 타격 비율 소수 3자리(0.000), 투구 비율 2자리(0.00), 소수 다음 자리 half-up, null은 `—`와 사유. 아웃은 `1아웃 (0⅓이닝)`, `4아웃 (1⅓이닝)`처럼 정수+분수로 표기하며 1.1이닝을 소수처럼 쓰지 않는다.
- 마지막 출전은 동일 scope의 마지막 확정 경기 completed_at의 KST 날짜로 정의한다(재개 경기는 완료일 기준임을 표시). daysSinceLastAppearance는 cutoffAt KST 날짜와의 날짜 차이며 출전 없으면 null. 오늘과의 차이를 데이터 기반 휴식일로 표시하지 않는다. 부상·결장 이유는 추정하지 않는다.
- 불펜 사용량 7일/14일은 cutoff KST 날짜 포함 `[D-6,D]`/`[D-13,D]`의 확정 경기 완료일 기준. 선발 등판을 불펜 사용량에 섞지 않는다. 연속 등판일은 cutoff 날짜 또는 전날에 끝나는 연속 출전 날짜 수, 둘 다 미등판이면 0. 두 경기 같은 날은 1일, 아웃은 둘 다 합산. 구간 밖 기록은 포함하지 않는다.

## 6. 구현 전 검수·변경 계약

P2에서 타입 strict + Zod 엄격 객체(unknown key 거부), DB composite FK/unique/check 및 fixture 테스트를 구현한다. 실패한 행을 조용히 제외해 게시하지 않는다. 다음은 **필수 검사 명세이며 실행 결과가 아니다**.

| fixture | 기대 |
| --- | --- |
| 동명이인/개명/이적/00 등번호 | 다른 playerId 보존, 동일 사람 ID 유지, 팀별 시즌 합=전체 |
| 음수·소수·누락 필수·교차 배치 FK·중복 경기 행 | 배치 전체 거부, 기존 release 유지 |
| BB=2 IBB=1, PA 잔여 타석, NP 미제공 | BB 이중 가산 없음, 유효 잔여 허용, NP=null |
| 1아웃·0아웃·AB=0·부분 null | 분수 이닝 정확, 비율 null 사유 구별, 완전 지표 보존 |
| 휴식 사이 10출전·더블헤더·선발/구원 전환 | 선수 출전 기준, DH 각각 계수, 평가 role 분리 |
| 중단→재개→final→정정→void | release별 재현, 새 배치 재계산, 이중 계수 0 |
| 등록 미출전/미등록 출전/관측 없음 | registered/unregistered/unknown 정확, 출전과 독립 |
| cutoff 이후 경기 추가 | 과거 cutoff 표본 불변, 사후 정정 여부는 release로 구분 |
| 권리 철회·만료/미승인·실제-가상 혼합 | 수입/게시/공개/과거 복구 차단 |

현재 DB/코드가 없어 migration 대상은 없다. P2 최초 migration에 이 계약을 반영한다. 이후 필드/기간/ID 의미의 파괴적 변경은 새 API major+입력 변환 버전+DB migration+이전 fixture 회귀 검증을 동반한다. 모델 변경은 새 score_version과 release로 게시하며 과거 snapshot을 갱신하지 않는다.
