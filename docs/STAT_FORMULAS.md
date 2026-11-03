# 타자 통계 V1 (DEMO)

`src/stats/batting.ts`는 I/O 없는 순수 함수다. 경기별 raw 정수 합계를 먼저 구한 뒤 계산한다. 경기별 비율의 산술평균은 사용하지 않는다. 모든 출력은 기술통계이며 실제 선수 공식 기록이 아니다.

| 지표 | 분자 | 분모 | 단위 |
| --- | --- | --- | --- |
| AVG | H | AB | 비율 |
| OBP | H+BB+HBP | AB+BB+HBP+SF | 비율 |
| SLG | TB | AB | 루타/타수 |
| OPS | OBP+SLG | 해당 없음 | 합성 비율 |
| ISO | SLG−AVG | 해당 없음 | 루타/타수 차이 |
| BB% | BB | 제공 PA | % |
| K% | SO | 제공 PA | % |
| HR/PA | HR | 제공 PA | 홈런/타석 |
| H/PA | H | 제공 PA | 안타/타석 |
| SB, CS | 각 합계 | 1 | 도루 성공 횟수, 도루 실패 횟수 |

1B = H−2B−3B−HR, TB = 1B+2×2B+3×3B+4×HR.
내부 이름 doubles=2B, triples=3B, sac=희생번트, sf=희생플라이, ci=타격방해 등 타석으로 인정되는 방해 출루다.
SB/CS는 두 개의 횟수 지표로 제공하며 성공률 또는 두 수의 몫으로 표시하지 않는다.

## PA 계약과 타당성

이 라이브러리의 검증 계약은 PA = AB+BB+HBP+SF+SAC+CI다. BB는 고의사구를 포함하므로 별도 중복 가산하지 않는다.
SAC와 CI는 PA에 포함하고 OBP 분모에는 포함하지 않는다. SF는 PA와 OBP 분모 모두에 포함한다.
이는 로컬 입력 계약이며 외부 공급자 공식 PA 정의를 확인했다는 뜻이 아니다. 다른 방해 사건 분류는 adapter에서 명시적으로 합의해야 한다.

공식 PA는 입력값 그대로 합산한다. 모든 세부 항목이 있는 행은 각각 등식을 검사한다. 불일치는 오류로 거부한다.
일부 필드 누락은 `paValidation=unverifiable`이며, PA를 역산하거나 검증 완료로 표시하지 않는다.
제공된 PA만으로 타석당 지표는 계산 가능하다. 부분 합계가 PA를 초과하는 경우에도 거부한다.
음수·소수·NaN·안전 정수 범위 초과와 H>AB, SO>AB, 장타 합계>H를 거부한다.

## 결측과 표본

어느 출전에서든 지표 필수 필드가 undefined/null이면 해당 합계와 지표는 unavailable(`value=null`, `reason=missing_fields`)이다.
누락 행을 버리거나 0으로 대입하지 않는다. OBP는 BB/HBP/SF 존재를 확인하며 SLG는 doubles/triples/HR까지 전부 필요하다.
분모 0은 `zero_denominator`, 빈 입력은 출전 없음/N/A다. OPS/ISO도 구성 지표가 unavailable이면 unavailable이다.
분자·분모 및 raw 합계는 결과에 유지한다. 합성 지표는 단일 분자·분모가 없어 null이다.

`minPA` 기본값 1은 채택한 기술통계 표시 기준이다. 1 PA의 안정성을 주장하지 않는다.
설정 임계값 미만이면 `small_sample`과 표본 부족 라벨을 표시한다. PA 누락 시 표본 미확인 라벨이며,
기본 기준에서는 필수 필드가 있는 AVG 등만 제공한다. minPA>1의 명시적 표본 게이트는 PA 미확인도 차단한다.
최근 창에 요청 출전 수가 부족하면 `windowComplete=false`와 실제 출전 수를 제공한다. 있는 표본은 계산하되 안정성 추론은 하지 않는다.

## 시즌/최근 출전과 추적

호출자는 한 선수·시즌·대회로 scope를 한정해야 한다. `compareBatting`은 시즌 전체와 최근 3/5/10/20 출전을 독립 재계산한다.
출전 로그 없는 날은 포함하지 않는다. 대주자 등 PA=0의 실제 출전 로그도 출전 수에 포함한다.
날짜 내 더블헤더 순서 후 game ID로 정렬하고 동일 game ID 중복은 거부한다. 입력은 변경하지 않는다.
각 창에 sourceId, asOf, gameId, inputRef를 보존한다.

게시 조회 `pipeline.publicResults(season, competition)`의 `battingStats[playerId]`에 연결했다.
기존 권리 검사 후 FINAL 경기와 공개 출전 행만 사용한다. DEMO 배지(`demo=true`), 응답 시즌/대회,
원본 batch/license 참조를 유지한다. 기존 저장 형식/API 필드는 변경하지 않고 응답 필드만 추가한다.
기존 샘플에는 세부 항목이 없어 OBP/SLG 등은 N/A다. 선수 목록의 기존 fixture 조회와 별도인 게시 조회 경로다.
외부 수집이나 추가 설치는 없다.

## 반올림 및 검증

계산 중 반올림하지 않는다. `formatMetric`만 표시 시 비율 소수 셋째 자리, 백분율 소수 첫째 자리로 `toFixed` 반올림한다.
백분율 내부 값은 0~1 비율이며 표시 시 100을 곱한다. 횟수는 정수, unavailable은 N/A다.
JS 부동소수점으로 계산하고 테스트는 12자리 허용 오차를 사용한다.

`fixtures/stats/hand-calculated.json`에 손계산 15개가 있다. 예: 1/1과 0/9는 합계 AVG 1/10=.100,
H=4(단타/2루타/3루타/홈런 각 1), AB=5는 TB=10, SLG=2.000, ISO=1.200이다.
SF/SAC/CI, PA 불일치, 결측 전파, 합계, 최근 출전, 조회 adapter는 `tests/unit/batting.test.ts`에서 검증한다.
실행: `pnpm test`, `pnpm typecheck`, `pnpm lint`.

wRC+, wOBA, WAR는 **V2 미구현**이다. 정의·시즌별 계수·원자료 권한 및 공급자 계약 확인 후 별도 설계한다.

# 투수 통계 V1 (DEMO 개발용)

`src/stats/pitching.ts`는 서버·DB 의존성 없는 순수 계산 라이브러리다. 기존 ingest/DB/API 계약은 변경하지 않는다.
`pitchingStats`는 raw 합계를, `comparePitching`은 지정한 playerId/season/competition의 역할별 합계와 최근 시리즈를 반환한다.
모든 입력은 최종 유효 기록이어야 한다. 정정 전/후 행을 동시에 더하지 않으며 같은 경기 중복은 거부한다.
자책점 정정은 최신 행으로 교체하여 재호출한다. 정정된 inputRef/asOf는 각 창의 provenance에 보존한다.

| 지표 | 계산 |
| --- | --- |
| IP | outsRecorded / 3 (숫자 계산 전용) |
| 이닝 표시 | floor(outsRecorded/3).(outsRecorded%3) 문자열 |
| ERA | 9 × ER / IP |
| WHIP | (BB + H) / IP |
| K/9, BB/9, HR/9 | 9 × 해당 raw 합계 / IP |
| K%, BB%, K−BB% | SO/BF, BB/BF, (SO−BB)/BF |

17 outs의 IP는 17/3이며 표시는 `5.2`(5⅔)다. `0.1`/`0.2`도 실제 1/2아웃이다.
표시 문자열을 소수로 변환해 계산하지 않는다. IP=0이면 IP를 분모로 쓰는 지표만 N/A다.
BF가 제공되면 0아웃 등판도 BF 비율은 계산할 수 있다. BF 누락은 역산하지 않으며 BF=0은 N/A다.
백분율 값은 내부적으로 비율(0.25), 표시 때 100을 곱한다. 기존 `formatMetric`을 사용할 수 있다.
계산 중 반올림하지 않으며 분자·분모·원시 합계와 null 사유를 반환한다.

## BB/IBB 계약

각 입력 행에 `walkDefinition`을 반드시 지정한다. `includes_ibb`의 BB는 IBB를 이미 포함하므로 다시 더하지 않는다.
`excludes_ibb`의 BB는 일반 볼넷만 뜻하므로 IBB를 더해 정규화한다. 이 경우 IBB 누락 시 BB 합계/관련 지표도 N/A다.
정규화된 BB를 WHIP, BB/9, BB%, K−BB%에 동일하게 사용한다. IBB 합계는 별도 유지한다.
포함형에서는 IBB가 BB를 초과할 수 없다. 실제 공급자 정의를 확인했다는 의미가 아니며 adapter에서 매핑해야 한다.
필드 누락은 0으로 간주하지 않는다. 한 행이라도 누락이면 해당 합계는 null이다.
음수·소수·NaN·무한대·안전 정수 초과, ER>R, HR>H, BF 구성 합 초과, 잘못된 SV/HLD를 거부한다.

## 역할·표본·범위

각 등판에 STARTER/RELIEVER를 저장한다. 등록 포지션·투구 이닝·승패로 역할을 추정하지 않는다.
`starter`는 최근 3/5선발, `reliever`는 최근 5/10구원 등판을 별도 필터링한 후 선택한다.
`g`는 해당 역할의 실제 등판 수, `gs`는 선발 역할의 등판 수다. SV/HLD/R/ER/H/HR/SO/BB/IBB/HBP/BF와
outsRecorded는 `totals`에 있다. 선발/구원 합계를 섞은 평가 시리즈는 제공하지 않는다.
0아웃 등판도 G와 최근 창에 포함한다. 같은 날 두 경기는 서로 다른 gameId와 order로 보존한다.
날짜·경기 순서 내림차순, 동률은 gameId 순으로 정렬하며 입력을 변경하지 않는다.
시즌·대회·선수를 먼저 필터링하여 시즌 경계를 넘는 최근 창을 만들지 않는다.
완투와 노디시전도 다른 등판과 동일하게 계산하며 승패 필드는 요구하지 않는다.
빈 입력·요청 등판 수 부족은 실제 표본/`windowComplete`로 노출한다. 안정성 임계값이나 기세 점수를 주장하지 않는다.
출전 없는 날짜를 임의로 만들지 않는다. 휴식·결장 원인은 본 라이브러리에서 추정하지 않는다.

FIP는 **비활성화** 상태이며 `league_season_constant_unavailable`을 반환한다.
리그·시즌별 검증된 상수와 산출 정의/출처, HR/BB/HBP/SO/IP가 모두 갖춰진 별도 계약을 채택하기 전에는 켜지 않는다.
임의 상수·추정 필드로 계산하지 않는다. API/화면 연결은 이번 라이브러리 구현 범위에 포함하지 않는다.

검증: `pnpm exec vitest run tests/unit/pitching.test.ts`.
