# 설명 가능한 기세 점수 v0.1 정식 사양

공개 DEMO 스냅샷/API 연결은 ADR-017 및 API_CONTRACT의 기세 API 절을 따른다. 아래 고정 창·내부 V 비교 규칙은 기존 v0.1 원형이며, 새 공개 버전은 3/5/10/20 선택과 저장된 직전 유효 snapshot 기반 deltaScore를 제공한다.

기준일: 2026-11-03 (Asia/Seoul). 모델 ID `momentum_v0_1_0`, 설정 ID `momentum_config_v0_1_0`.

상태: **계산 사양 채택 / 순수 TypeScript 계산·DEMO 단위 검증 구현 / 실증 보정·API·UI 연결 전**. 이 문서는 P3 계산 구현의 규범이다. 서비스의 `model_pending`을 자동 해제하지 않는다. [통계 수식](STAT_FORMULAS.md), [데이터 사전](DATA_DICTIONARY.md), [API 계약](API_CONTRACT.md)을 유지한다. 아래 설명 객체는 내부 구현 사양이며 현재 공개 DTO나 DB 스키마가 아니다. 공개 연결 시 계약 갱신·필요한 마이그레이션·테스트를 별도로 수행한다.

점수는 최근 기록의 역할별 기술 요약이다. **공식 기록·공인 지표·절대 능력·미래 성적·승부 확률이 아니다.** 50은 모델의 중립점이며 리그 평균 순위나 50%가 아니다. 현재 입력과 예시는 자체 제작 **DEMO**다. 외부 수집·설치·실제 데이터 사용 권한을 전제하지 않는다.

## 1. 입력과 기간 N

평가 키는 `(leagueId, season, competition, playerId, role, cutoffAt, releaseId, modelVersion, configHash)`다. 리그·시즌·대회·역할을 섞지 않는다. 시즌은 날짜로 추정하지 않고 입력 scope를 사용한다. 내부 역할과 기존 API 역할은 `hitter → batter`, `starting_pitcher → starter`, `relief_pitcher → reliever`로 명시적으로 매핑한다.

- 고정 release에서 최신 확정 revision의 FINAL 기록만 사용한다. `completedAt ≤ cutoffAt`, 행 `asOf ≤ cutoffAt`이어야 한다. 미래 경기·정정·baseline은 금지한다. 당시 기록 재현과 최신 정정 재계산은 다른 release다.
- 권리 검사와 기존 PA/BF·BB/IBB 검증을 먼저 수행한다. 음수·비정수 count, 중복 경기, 역할 미상, 불일치한 사건 합계는 `invalid_input`으로 거부한다. PA/BF를 타수·아웃으로 역산하지 않는다.
- `(playedOn, doubleheaderNo, gameId ASCII)` 오름차순으로 정렬한다. 투수의 같은 경기 행은 역할 하나만 갖는다. 한 행의 선발/불펜 혼합은 승인된 분할 계약 없으면 거부한다. 투타 겸업은 별도 모델로 처리한다.
- **N은 해당 역할로 실제 출전한 횟수**다. 타자 PA=0 출전, 투수 outs=0 등판도 포함한다. 출전 로그 없는 날을 0기록으로 만들지 않는다. 타자 최근 10출전, 선발 최근 5선발, 불펜 최근 10구원이다. 점수 API에서 임의 N 변경은 허용하지 않는다.
- `W`는 최근 N출전, `V`는 최신 출전 하나를 제거한 뒤 최근 N출전이다. 직전 N출전 블록이 아니라 N−1건이 겹치는 이동창이다. N 미만이면 실제 출전 수와 `windowComplete=false`를 보존하고 표본 게이트를 적용한다.
- `S`는 W의 첫 출전보다 엄격히 앞선 선수의 동일 시즌·대회·역할 누적 기록이다. W를 시즌 기준에 중복 포함하지 않는다. 리그 baseline도 같은 경계 이전만 사용한다. W와 V 비교에는 **현재 W 경계에서 고정한 S와 리그 baseline**을 공통 적용한다. V가 S 마지막 출전을 포함할 수 있다는 사실을 설명에 남긴다.

## 2. 버전 설정 상수

다음 값은 검증된 리그 경험값이 아니라 **채택한 v0.1 DEMO 기본값**이다. 모두 직렬화 가능한 config에 보존한다. 수식의 3(아웃/이닝), 27(9이닝 아웃), 1.4826(MAD 척도 계수)은 정의 상수다. 다른 정책 숫자를 구현에 숨기지 않는다.

| 설정 | hitter | starting_pitcher | relief_pitcher |
| --- | --- | --- | --- |
| `N` | 10 | 5 | 10 |
| `minAppearances` | 3 | 2 | 3 |
| `minPA / minBF / minOuts` | 12 / null / null | null / 30 / 18 | null / 12 / 6 |
| `mediumPA / mediumBF / mediumOuts` | 30 / null / null | null / 75 / 45 | null / 30 / 18 |
| `highPA / highBF / highOuts` | 60 / null / null | null / 150 / 90 | null / 60 / 36 |
| `tauPA / tauBF / tauOuts` | 40 / null / null | null / 100 / 60 | null / 40 / 24 |
| `personalBaselineMinAppearances` | 10 | 3 | 10 |
| `personalBaselineMinPA / BF / Outs` | 40 / null / null | null / 75 / 45 | null / 40 / 24 |
| `cohortMinPlayers` | 20 | 10 | 15 |
| `staleAfterDays` (초과 시 보류) | 14 | 21 | 14 |
| `restNoticeAfterDays` (초과 시 안내) | 3 | 7 | 3 |

| 공통 설정 | 값과 의미 |
| --- | --- |
| `componentWeights` | level=.55, seasonChange=.30, previousChange=.15 |
| `temperature / zClip` | 1.0 / 3.0 |
| `minFeatures / minFeatureWeight` | 2 / .60 (남은 원래 feature 가중치 합) |
| `numericTolerance / scoreDisplayDigits / explanationTopK` | 1e-12 / 1 / 3 |
| `medianRule` | 짝수 개는 중앙 두 값 평균 |
| `confidenceLabels` | low=제한된 표본, medium=중간 표본, high=상대적으로 큰 표본 |
| `roundRule` | 비음수 표시 점수에 `floor(x*10^digits+.5)/10^digits` 적용 |

설정 검증: 수치는 유한값, tau/temperature/scale floor는 양수, 출전 수·날짜·표본 임계값은 정수, min ≤ medium ≤ high, 가중치는 비음수이고 각 묶음 합은 1이다. null은 해당 역할에서 사용하지 않는 단위다. 변경 시 설정 ID·hash와 모델 patch 이상을 갱신하고 새 release에서 재계산한다. 사용자별 숨은 tau/temperature 조정은 금지한다.

## 3. 역할별 feature와 근거

창 안의 raw 정수를 먼저 합산해 지표를 계산한다. 경기별 비율의 평균은 금지한다. 내부 비율은 0~1 단위다. 아래 feature 가중치는 각 성분 내부에서 사용하며 55/30/15와 별개다.

| 역할 / feature | 정의 | 좋은 방향 d | 가중치 | scale floor | 근거·한계 |
| --- | --- | --- | --- | --- | --- |
| hitter / OBP | (H+BB+HBP)/(AB+BB+HBP+SF) | +1 | .40 | .020 | 출루. SAC/CI는 분모에서 제외 |
| hitter / ISO | (TB−H)/AB | +1 | .35 | .020 | 장타 성분. TB=H+2B+2×3B+3×HR |
| hitter / KRate | SO/PA | −1 | .25 | .020 | 삼진으로 소모한 타석. 타구 질은 측정하지 못함 |
| starting_pitcher / KMinusBB | (SO−BB)/BF | +1 | .45 | .020 | 탈삼진·볼넷 수지. 수비 영향을 일부 줄임 |
| starting_pitcher / WHIP | 3×(H+BB)/outs | −1 | .35 | .100 | 출루 허용. 수비·구장·상대 영향 존재 |
| starting_pitcher / OutsPerStart | outs/등판 수 | +1 | .20 | 1.000 | 선발의 투구 지속량. 투구 제한·전술에도 영향받음 |
| relief_pitcher / KMinusBB | (SO−BB)/BF | +1 | .50 | .020 | 짧은 등판에서 탈삼진·볼넷 수지 |
| relief_pitcher / WHIP | 3×(H+BB)/outs | −1 | .30 | .100 | 출루 허용. 승계주자 결과를 직접 반영하지 않음 |
| relief_pitcher / HRRate | HR/BF | −1 | .20 | .010 | 장타 손실의 일부. 소수 피홈런에 민감하므로 clip·수축 필수 |

KMinusBB의 음수는 유효하다. 분모 0은 N/A이며 0값이 아니다. ERA=27×ER/outs는 설명용 보조 표시로만 제공한다. **ERA는 작은 표본의 몇 자책점만으로 급변하고 수비·승계주자·기록 정정에도 영향받으므로 점수에 넣지 않는다.** 승패·SV·HLD·FIP·승률도 feature가 아니다. AVG/OPS는 보조 표시이며 OBP/ISO와 중복 가중하지 않는다.

## 4. 시즌·대회·역할 baseline

`baselineKey=(leagueId, season, competition, role, W시작 전 경계, releaseId, featureDefinitionVersion)`를 고정한다. 다른 시즌·대회·리그·역할로 자동 fallback하지 않는다. 같은 리그 내 이적은 선수 ID로 연결하고 팀 필터가 baseline을 바꾸지 않게 한다.

1. 경계 이전 각 선수의 동일 역할 누적 raw 합계를 구한다. 표의 `personalBaselineMinAppearances` 및 해당 PA/BF/outs 조건을 **모두** 충족해야 cohort 후보가 된다. 기회 수로 가중하지 않고 선수당 관측값 하나를 사용한다. 평가 대상 선수는 cohort에서 제외한다.
2. feature별 필수 항목이 전부 있는 후보만 사용한다. 후보 수가 `cohortMinPlayers` 미만이면 그 feature의 baseline은 unavailable이다. 나머지는 `m[j]=median(x)`, `MAD[j]=median(abs(x−m[j]))`, `s[j]=max(1.4826*MAD[j],scaleFloor[j])`로 계산한다. MAD=0도 floor를 적용해 사용한다.
3. 선수의 S가 개인 baseline 최소 출전·표본 조건을 모두 충족하고 해당 feature도 계산 가능하면 `b[j]=feature(S,j)`다. 아니면 `b[j]=m[j]`, `rS[j]=0`, `personal_baseline_fallback`을 기록한다. 개인 baseline 채택 시 `rS[j]=reliability(S)`로 표본 수축한다.
4. cohort baseline 부족은 다음 절의 feature 제외·재배분 정책을 적용한다. 필요 수·가중치에 못 미치면 `baseline_unavailable`로 보류한다. 시즌 초·포스트시즌 시작 직후에는 점수 보류가 정상이다. 지난해 평균을 임의로 대입하지 않는다.
5. cohort는 충분하고 개인 baseline만 부족하면 점수를 허용한다. 해당 seasonChange는 0이고 현재 창 표본 수축도 적용한다. hard minimum 미만을 중립점 50으로 표시하지 않는다.

baseline artifact에는 후보·제외 선수 ID, raw 참조, feature 값, median/MAD/scale, 인원수, 경계, 산출 버전·hash를 저장한다. 출처 없는 외부 평균값만 붙이는 방식은 허용하지 않는다.

## 5. 결측·표본·휴식 정책과 판정 순서

다음 순서로 primary status 하나를 결정하고 해당 품질 flags는 모두 남긴다.

1. 권리 미충족은 공개 거부, 입력 검증 실패는 `invalid_input`이다.
2. 해당 역할의 확정 출전 없음 → `no_appearances`, 점수·confidence=null.
3. 타자 PA, 투수 BF/outs, 출전 로그 완전성 또는 마지막 출전일 미확인 → `missing_data`. 표본을 추정하지 않는다. 출전 행이 빠진 것이 확인된 경우도 보류한다.
4. `daysSinceLastAppearance > staleAfterDays` → `inactive`, 현재 점수=null. cutoff의 Asia/Seoul 날짜와 최신 동일 역할 playedOn의 달력 날짜 차이를 사용한다. 미래 출전일은 invalid_input. 마지막 점수는 날짜가 붙은 과거 이력으로만 제공한다.
5. minAppearances 또는 해당 hard minimum PA/BF/outs 중 하나라도 미달 → `insufficient_sample`. N 미충족만으로 보류하지는 않는다.
6. **W의 어느 한 행이라도** feature 필수 항목이 없으면 해당 feature 전체를 제외한다. 결측 행 제거·0 대입은 금지한다. cohort baseline이 없는 feature도 제외한다. 남은 집합 F의 개수≥minFeatures이고 원래 가중치 합≥minFeatureWeight이면 `w'[j]=w[j]/sum(w[F])`로 재배분한다. 아니면 N/A다. baseline 부족이 원인에 포함되면 `baseline_unavailable`, 그 외는 `missing_data`; 모든 제외 이유를 함께 보존한다.
7. V가 표본 부족·로그 불완전이거나 F 중 하나라도 계산 불가이면 **모든 feature의 previousChange를 0**으로 두고 `previous_window_unavailable`을 표시한다. 55/30/15는 재배분하지 않는다. 일부 feature만 직전 변화를 쓰지 않는다. S 결측은 개인 baseline fallback으로 처리한다. 현재·직전 점수 재계산에 같은 F를 사용한다.
8. 나머지는 `ready`. 휴식일에 자동 감점하지 않는다. `restNoticeAfterDays` 초과는 `rest_gap` 안내를 붙인다. 부상·말소·결장 사유는 명시적 권한 있는 입력만 표시하고 간격으로 추정하지 않는다. 다른 역할의 출전이 이 역할의 마지막 출전일을 갱신하지 않는다.

confidence는 현재 창만으로 분류한다. minimum 통과 후 타자는 PA≥highPA, 투수는 BF≥highBF **그리고** outs≥highOuts이면 high다. 다음으로 같은 방식의 medium 조건을 적용하고 나머지는 low다. 보류 시 null이다. N 미충족·결측 재배분·개인 baseline fallback은 별도 flag이며 등급을 임의로 바꾸지 않는다. **등급은 정해진 표본량 범주이며 정확도·확률·통계적 신뢰구간이 아니다.** high도 편향이나 결측이 사라졌다는 뜻이 아니다.

## 6. 정규화·수축·sigmoid

`clip(x)=min(zClip,max(−zClip,x))`다. 표본 수축 계수는 다음과 같다.

```text
reliability(W):
  hitter: PA/(PA+tauPA)
  pitchers: min(BF/(BF+tauBF), outs/(outs+tauOuts))
```

이하 `r(W)=reliability(W)`다. r은 내부 축소 계수이며 확률로 표현하지 않는다. 개인 baseline 사용 시 rS도 같은 식을 쓰고 fallback이면 0이다. d는 좋은 방향의 부호, s는 고정 baseline의 robust scale이다.

```text
L[j] = clip(d[j] * (feature(W,j)-m[j]) / s[j])
C[j] = rS[j] * clip(d[j] * (feature(W,j)-b[j]) / s[j])
P[j] = previousUsable
     ? min(r(W),r(V)) * clip(d[j] * (feature(W,j)-feature(V,j))/s[j])
     : 0
q[j] = .55*L[j] + .30*C[j] + .15*P[j]
z = sum(j in F, w'[j]*q[j])
u = r(W)*z / temperature
rawScore = 100/(1+exp(-u))
value = roundRule(rawScore, scoreDisplayDigits)
```

55%는 동일 시즌·대회·역할 대비 최근 수준, 30%는 본인의 사전 시즌 대비 변화, 15%는 직전 출전 시점의 창 대비 변화다. 개인 성분은 rS, 직전 성분은 두 창 중 작은 r로 먼저 수축하며 전체 점수도 r(W)로 50 방향에 수축한다. 부호 적용→차이의 robust 정규화→clip→성분별 수축→가중합→전체 수축→temperature→sigmoid 순서를 바꾸지 않는다. temperature가 클수록 50에 가깝고 tau가 클수록 작은 표본을 강하게 수축한다.

정렬은 반올림 전 rawScore를 사용한다. `previousValue`는 **같은 F·baseline·S·버전으로 V를 재계산**한 값이다. 그 계산에서는 L/C에 V를 넣고 P 전체를 0으로 둔다. `delta=rawScore(W)−rawScore(V)`이며 표시만 반올림한다. UI는 “같은 기준으로 재계산한 직전 출전 대비”라고 표시한다. 과거 release에 저장된 점수와의 차이가 아니다. previousUsable=false면 previousValue/delta=null. 실제 과거 점수는 별도 이력으로 보존한다.

## 7. 구현 가능한 의사코드

```text
score(input, config):
  validateConfig(config)
  validateRightsScopeCountsRevisionsAndCutoff(input)
  A = sort(filterFinalRowsForExactScope(input.rows))
  if empty(A): return withheld(no_appearances)
  W = tail(A, N)
  V = tail(dropLast(A), N)
  flags = collectCoverageRestRoleAndRevisionFlags(input, W)
  if missingSampleOrCoverageOrDate(W): return withheld(missing_data, flags)
  if calendarDaysSinceLastRoleAppearance(W) > staleAfterDays:
    return withheld(inactive, flags)
  if not meetsMinimum(W): return withheld(insufficient_sample, flags)
  S = filter(A, key < first(W).key)
  B = buildFrozenLeaveOnePlayerOutBaseline(input, boundary=first(W).key)
  F = [j for j in roleFeatures if complete(W,j) and B[j].available]
  if count(F) < minFeatures or sum(originalWeight(F)) < minFeatureWeight:
    return withheld(baseline_unavailable if anyBaselineFailure else missing_data,
                    allFeatureExclusionReasons)
  weights = normalize(originalWeight(F))
  previousUsable = completeCoverage(V) and meetsMinimum(V)
                   and all(complete(V,j) for j in F)
  for j in F:
    personalOK[j] = meetsPersonalMinimum(S) and complete(S,j)
    b[j] = feature(S,j) if personalOK[j] else B[j].median
    rS[j] = reliability(S) if personalOK[j] else 0
  current = computeFormula(W, V, F, B, b, rS, weights, previousUsable)
  previous = computeFormula(V, null, F, B, b, rS, weights, false)
             if previousUsable else null
  return ready(current.rawScore, previous?.rawScore,
               confidenceFromExactThresholds(W), fullExplanationAndFlags())
```

`complete`는 모든 행의 필수 raw 항목과 양의 분모를 검사한다. `meetsMinimum`은 출전 수 및 해당 PA/BF/outs를 모두 검사한다. 표본 검사에서 outs=0은 미상이 아니다. V 재계산은 현재 평가의 휴지 판정에 따르며 V의 가상 평가일을 오늘로 바꾸어 독립 inactive 판정하지 않는다. 입력 행·baseline·설정이 같으면 현재 시각이나 난수 없이 같은 결과가 나와야 한다.

## 8. score explanation과 UI 계약

아래 자료를 저장하지 못하면 설명 가능성 수락 기준을 충족하지 못한다.

- 모델·설정·feature 정의·계산 코드의 버전/hash, DEMO 여부, 평가 키, cutoffAt, 입력 asOf, 계산 실행 시각(계산값에는 미사용), release/batch/source/rights/inputRef/revision 및 입력 내용 hash.
- W/V/S의 출전 ID·순서·기간·요청 N·실제 수·windowComplete, PA/BF/outs, 마지막 동일 역할 출전·경과일, 명시된 부재 사유와 출처, baseline artifact 참조.
- feature별 필수 입력·합계·분자/분모·값·결측 사유, 방향 d, 원래/재배분 가중치, m/MAD/s, 개인 b/rS, 직전 값, clip 전후 L/C/P, q, `w'*q`. 제외 feature도 이유와 함께 남긴다.
- r(W)/r(V), z, temperature, u, rawScore, 표시 value, previousValue/delta, status/confidence와 품질 flags. 예: `small_sample_low`, `window_incomplete`, `rest_gap`, `inactive`, `missing_feature`, `weights_redistributed`, `personal_baseline_fallback`, `baseline_insufficient`, `previous_window_unavailable`, `role_changed`, `record_corrected`, `pa_unverifiable`, `demo`.
- 사람이 읽는 근거 목록: 모든 feature 기여를 상세에 남기고 요약은 `abs(w'*q)` 내림차순 상위 explanationTopK개다. 동률은 feature 표 순서다. 예: “출루율 .380이 같은 시즌·역할 기준 .330보다 높아 가점 방향”, “삼진율 .180이 기준 .200보다 낮아 가점 방향”, “40 PA이므로 중립점 방향으로 수축”. 0기여를 호조로 부르지 않는다.

기여도는 sigmoid 이전 단위이므로 더하면 점수 차이가 된다고 표시하지 않는다. 원수치와 식으로 재계산할 수 있어야 한다.

UI 상시 안내: **“선수 간 점수 비교는 동일 리그·시즌·대회·역할·기준일·모델/설정 안에서만 가능합니다. 역할을 가로질러 비교할 수 없습니다.”** 비교 화면은 역할이 다르면 거부하고 통합 랭킹을 제공하지 않는다. 결측 재배분으로 F가 다를 때도 “사용 지표가 달라 비교 불가”로 제외한다.

표시는 “설명용 기세 점수 (0~100)”, “공식 기록·승부 확률이 아닙니다”, “표본 신뢰도: 중간 (40 PA)”를 사용한다. 점수에 %를 붙이거나 “승리 확률”, “공식 폼 지수”, “예측 적중률”로 표현하지 않는다. N/A는 이유·필요 표본과 함께 표시하며 0점으로 대체하지 않는다. inactive의 과거 점수는 현재 랭킹에 사용하지 않는다.

## 9. DEMO 예시 입력 3개와 기대 결과

다음은 네트워크 없는 **계산기 경계 입력**이다. raw 합계와 고정 baseline artifact를 제공한다. baseline은 가상 fixture이지 실제 리그 추정값이 아니다. E2E 구현에서는 4절의 같은 median/MAD를 만드는 cohort 출전 행도 fixture로 구성하고 hash를 고정해야 한다. 이 문서는 E2E 구현 완료를 주장하지 않는다.

공통 메타: leagueId=`demo_league`, season=2026, competition=`regular`, cutoffAt/asOf=`2026-11-03T12:00:00.000Z`, sourceId=`demo_source_synthetic`, releaseId=`demo_momentum_release`, 모델/설정은 문서 첫 ID다. 모두 DEMO이고 출전 로그 순서·완전성이 확정되었으며 W의 마지막 출전일은 2026-11-03이다. A/B의 V는 W와 같은 raw 합계와 출전 수를 갖고 로그도 완전하다. 이동창에서 빠지고 들어오는 두 출전 행의 raw 값이 동일한 fixture를 사용한다. 따라서 previousUsable=true, P=0, previousValue는 현재 값과 같고 delta=0이다. B는 재배분된 F만으로 V를 검사한다. C는 표본 게이트에서 종료한다. 실제 행 입력에서는 합계를 구성하는 출전 행과 inputRef도 필수다.

### A. hitter: 출루·장타 개선, 중간 표본

```json
{
  "playerId": "demo_hitter", "role": "hitter",
  "W": {"g":10,"pa":40,"ab":33,"h":9,"doubles":3,"triples":0,"hr":2,"bb":5,"hbp":1,"sf":1,"sac":0,"ci":0,"so":8},
  "S": {"g":20,"pa":80,"ab":70,"h":20,"doubles":3,"triples":0,"hr":2,"bb":8,"hbp":1,"sf":1,"sac":0,"ci":0,"so":16},
  "baseline": {
    "OBP":{"count":20,"median":0.33,"mad":0.02},
    "ISO":{"count":20,"median":0.15,"mad":0.02},
    "KRate":{"count":20,"median":0.22,"mad":0.02}
  }
}
```

PA 등식은 40=33+5+1+1, 80=70+8+1+1이다. W는 OBP=.375, ISO=9/33=.272727…, KRate=.2이며 S는 OBP=.3625, ISO=9/70=.128571…, KRate=.2다. scale은 모두 .029652, r=.5, rS=2/3이다. L≈[1.5176,3,.6745], C≈[.2810,2,0], P=[0,0,0]. z≈1.247840, rawScore≈65.110956. **기대 범위 65.10~65.12, 표시 65.1, confidence=medium, ready**. ISO는 L과 개인 차이 양쪽에서 clip된다. 예시 범위는 문서 근삿값 검증용이고 동일 입력 구현 회귀 오차 기준은 numericTolerance다.

### B. starting_pitcher: 개인 baseline 부족, 두 feature 재배분

```json
{
  "playerId":"demo_starter","role":"starting_pitcher",
  "W":{"g":5,"bf":100,"outs":60,"so":25,"bb":5,"h":null},
  "S":{"g":3,"bf":60,"outs":36,"so":12,"bb":6,"h":10},
  "baseline":{
    "KMinusBB":{"count":10,"median":0.1,"mad":0.04},
    "WHIP":{"count":10,"median":1.3,"mad":0.1},
    "OutsPerStart":{"count":10,"median":15,"mad":1}
  }
}
```

S는 출전 수만 충족하고 개인 BF/outs minimum 미달이므로 두 feature의 rS=0이다. H 결측으로 WHIP 제외, 원래 가중치 합=.65≥.60, 재배분=[9/13,4/13]. W의 KMinusBB=.2, OutsPerStart=12. scale=[.059304,1.4826], L≈[1.6862,−2.0235], C=P=0, r=.5. z≈.2996, rawScore≈53.738380. **기대 범위 53.72~53.76, 표시 53.7, confidence=medium, ready**. missing_feature/weights_redistributed/personal_baseline_fallback/demo flags가 필요하다. 5선발만으로 high가 되지 않는다.

### C. relief_pitcher: 0아웃 등판 포함, 작은 아웃 표본으로 보류

```json
{
  "playerId":"demo_reliever","role":"relief_pitcher",
  "W":{"g":3,"bf":14,"outs":5,"so":4,"bb":2,"h":3,"hr":1},
  "S":{"g":10,"bf":40,"outs":24,"so":10,"bb":3,"h":5,"hr":0},
  "baseline":{
    "KMinusBB":{"count":15,"median":0.15,"mad":0.04},
    "WHIP":{"count":15,"median":1.2,"mad":0.1},
    "HRRate":{"count":15,"median":0.02,"mad":0.005}
  }
}
```

W의 세 등판 outs는 [0,2,3]이다. BF≥12지만 outs=5<6이므로 **status=insufficient_sample, value/rawScore/previousValue/delta/confidence=null**이다. 기대 범위는 N/A이며 0~50 같은 수치 범위를 갖지 않는다. 빠진 1아웃을 추정하지 않는다. UI: “3등판·14 BF·5아웃, 최소 6아웃 미달”.

## 10. 비교 편향과 보정 절차

같은 역할에서도 구장·수비·상대·선발 기용·승계주자·레버리지·등판 간격 차이가 남는다. v0.1은 이를 보정하지 않는다. cohort는 현재 등록 선수로만 제한하지 않고 경계 전 조건을 충족한 전체 선수를 포함하지만 출전 기회에 따른 선택 편향은 남는다. 리그나 역할이 다르면 “70점끼리 동등하다”고 해석할 수 없다. 선발→불펜 전환 시 두 창·baseline·휴지 일수를 독립 유지하고 이전 역할 BF/outs로 최소 표본을 채우지 않는다. 선발 inactive와 불펜 ready가 동시에 가능하다.

보정은 승리 확률 학습이 아니라 설명의 안정성과 표본 의존성을 확인하는 절차다.

1. 승인된 DEMO raw 출전 fixture, cohort artifact, 권리 정보, 설정, 기대 설명을 고정하고 hash를 남긴다. 0분모·0 MAD·각 임계값 직전/일치/직후·잘못된 tau/temperature·1/2 feature 결측·cohort 부족·역할 전환·시즌/대회 경계·같은 날 DH·휴지 경계·정정·미래 행 제외를 검증한다.
2. 시계열 경계를 고정하고 이전 자료만으로 baseline을 만든다. 나중 정정을 사용한 계산은 별도 release다. 보류한 기간의 분포·clip 비율·N/A 비율·재배분 비율·출전별 변화·설명 기여를 역할별 보고한다. 정확도·승률로 바꾸어 표현하지 않는다.
3. L/C/P를 고정하면 표본 증가 시 50에서의 거리가 비감소, tau/temperature 증가 시 거리가 비증가하는지 검사한다. baseline/F/표본을 고정한 단일 feature의 좋은 방향 개선은 점수를 낮추지 않아야 한다. 입력 순서 변경·반복·raw 합계 손계산의 결과는 numericTolerance 이내에서 일치해야 한다.
4. 가중치·N·tau·temperature·scaleFloor·minimum 후보는 별도 config로 비교한다. 기존 v0.1을 덮어쓰지 않는다. 설명 일관성·반례·모든 역할의 결측/작은 표본 동작을 근거로 채택한다. 검증되지 않은 안정성이나 임의 목표 백분위 달성을 주장하지 않는다.
5. 실제 데이터 검증은 권리·공급 계약 승인 후에만 수행한다. 최적 파라미터·리그 대표성·미래 타당성은 아직 미확인이다. 새 설정은 ADR 채택과 회귀 검증 후 새 버전/release로 공개한다.

수락 기준: 보존된 입력 행·baseline·설정만으로 feature→방향→robust 정규화→clip→수축→가중합→sigmoid→표시 점수를 재현하고, 보류 이유와 비교 불가 조건도 일치해야 한다. **문서 검증을 모델 구현·P3 앱 테스트 완료로 간주하지 않는다.**


## 11. 순수 함수 구현 진입점

`src/stats/momentum.ts`의 `scoreMomentum(input)`과 `extractMomentumBaseline(input)`을 사용한다.
입력 타입은 같은 파일의 `Input`/`Row`이며 외부 패키지나 I/O를 요구하지 않는다.
기존 batting/pitching raw 검증·BB/IBB 정규화를 재사용한다.

- `scoreMomentum`: `ready`일 때만 유한 `rawScore`, confidence, eligibility 및 전체 설명을 제공한다. 보류 시 점수는 null이고 status에 rights_denied/invalid_input/no_appearances/missing_data/inactive/insufficient_sample/baseline_unavailable 이유를 담는다.
- `extractMomentumBaseline`: 같은 cutoff와 W 경계로 feature별 median/MAD/scale, 후보 표본, 제외 선수, 원본 참조 artifact를 추출한다. 추출 status=ready는 artifact 생성 성공을 뜻하며 feature별 available 및 최소 feature 가중치 통과를 뜻하지 않는다.
- `robustNormalize`, `median`, `shrinkage`: 비유한 수와 잘못된 scale/tau에 null을 반환한다. MAD=0은 baseline 단계의 양수 floor로 처리한다.
- 반환값에 표시 반올림 `value`는 넣지 않는다. 원점수와 delta의 표시 반올림은 presentation layer에서 수행한다.
- raw fixture 생성과 경계/회귀 검증: `tests/unit/momentum.test.ts`. 실행: `node_modules/.bin/vitest run tests/unit/momentum.test.ts`.

실행 시각은 입력/계산에 사용하지 않는다. 감사용 실행 시각·artifact 영속화·암호학적 해시는 추후 adapter 계층의 책임이다. 공개 DTO 및 UI의 model_pending은 유지한다.

### 구현 검증 기록 (2026-11-03)

- `node_modules/.bin/vitest run`: 10개 파일, 157개 테스트 통과. 이 중 momentum은 75개다. 테스트 안에서 생성하는 자체 DEMO raw/cohort 입력으로 세 역할의 baseline부터 score까지 검증한다.
- `node_modules/.bin/tsc --ignoreConfig --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck src/stats/momentum.ts tests/unit/momentum.test.ts`: 변경 계산/테스트 파일 strict 검사 통과.
- `node_modules/.bin/eslint src/stats/momentum.ts tests/unit/momentum.test.ts --max-warnings=0`: 통과.
- `node_modules/.bin/tsc --noEmit`: 실패. 기존 `prisma.config.ts(1,30)`에서 `prisma/config` 모듈/타입을 찾지 못한다. 새 패키지는 설치하지 않았다. 전체 프로젝트 타입 검사 통과를 주장하지 않는다.
- 화면 변경이 없어 브라우저/E2E/build는 미실행이다. 모델 확인은 위 테스트 명령으로 수행한다. 공개 화면 연결은 API 계약과 표시 반올림·설명 컴포넌트를 준비한 후 별도 단계에서 검증한다.

## 12. v0.1 내부 결과 계약과 고정 골든 fixture

`calculateMomentum(input)`은 기존 `scoreMomentum`을 호출하는 순수 진입점이다.
기존 raw 산식/상태와 공개 API 계약을 보존한다. 성공 시 `score`는 소수 첫째 자리의
0~100 가독형 점수, `label`은 반올림 전 rawScore ≥60이면 상승, ≤40이면 하락,
그 사이는 보통이다. 이 임계값은 실증 보정 전 DEMO 정책이다.
`reasons`는 사용 가능한 feature별 근거 2~3개, `warnings`는 기존 flags,
`confidence`는 표본량 등급, `n`은 appearances/opportunities/outs다.
`sourceMode=demo`, `asOf=cutoffAt`, `algorithmVersion=momentum_v0_1_0`,
시즌·대회·역할 scope와 확률이 아니라는 disclaimer를 포함한다.
`audit`에는 모든 원본 참조, feature 값·방향·정규화·기여·baseline·정정 revision과 hash를 보존한다.

실패 시 `status=withheld`, score/rawScore/label/confidence=null이다.
rights_denied → data_not_licensed, baseline_unavailable → invalid_baseline,
missing_data/no_appearances/insufficient_sample → insufficient_data로 매핑한다.
invalid_input/inactive는 그대로 보존하며 `detailReason`과 audit에서 원래 이유를 확인한다.
검증 전 실패하면 n=null이고, 검증된 창이 있으면 실제 표본을 보존한다.
권리 미승인 입력을 실제 데이터 모드로 계산하는 경로는 없다.

### 고정 기대값 12개

입력 생성 규칙은 `fixtures/stats/momentum-input.ts`의 `momentumScenario`, 기대값은
`fixtures/stats/momentum-golden.json`에 고정한다. 테스트 실행 중 기대값을 생성하지 않는다.
모두 자체 제작 DEMO이며 공식 선수 기록이 아니다. 기존 9절 예시는 별도의 설명용 집계 입력이다.

공통 cohort는 20명×10출전(10월 1~10일), target은 10월 11~21일 11출전이다.
타자 기본 기록은 경기당 PA=AB=4, H=1, SO=1, 나머지 필수 사건=0이다.
투수 기본은 BF=25, outs=18, SO=5, BB=1, H=4, HR=IBB=HBP=R=ER=0이다.
up/down은 target의 10월 17~21일 5경기만 바꾼다.
타자 up은 H=3/2B=1/SO=0, down은 H=0/2B=0/SO=3이다.
투수 up은 SO=10/BB=0/H=1/HR=0, down은 SO=1/BB=4/H=8/HR=2다.
이외 입력은 기본과 같다. sample은 target의 마지막 1출전만 남기고,
baseline은 cohort를 제거하며 unlicensed는 rights=denied를 주입한다.

| ID | rawScore (근삿값) | 표시 점수 | label / reason | confidence |
| --- | ---: | ---: | --- | --- |
| hitter-neutral | 50.000000000000 | 50.0 | 보통 | medium |
| hitter-up | 70.901913378509 | 70.9 | 상승 | medium |
| hitter-down | 35.929220408605 | 35.9 | 하락 | medium |
| starting_pitcher-neutral | 50.000000000000 | 50.0 | 보통 | medium |
| starting_pitcher-up | 73.980172442996 | 74.0 | 상승 | medium |
| starting_pitcher-down | 25.550287876560 | 25.6 | 하락 | medium |
| relief_pitcher-neutral | 50.000000000000 | 50.0 | 보통 | high |
| relief_pitcher-up | 77.331245857806 | 77.3 | 상승 | high |
| relief_pitcher-down | 17.403472855429 | 17.4 | 하락 | high |
| hitter-sample | null | null | insufficient_data | null |
| hitter-baseline | null | null | invalid_baseline | null |
| hitter-unlicensed | null | null | data_not_licensed | null |

독립 합계 검산: 타자 W/V 변경 비중은 .5/.4, rW=.5, 개인 baseline 표본 미달로 rS=0이다.
선발 W/V 비중은 1/.8, rW=125/225, rS=150/250이다.
불펜 W/V 비중은 .5/.4, rW=250/290, rS=0이다.
모든 cohort의 MAD=0이므로 feature별 scale floor를 사용한다.
각 합계에서 L/C/P를 계산하고 6절 수식에 대입한 값을 JSON에 고정했다.
JSON raw 오차는 1e-12 이내로 검사하고 표시 값·label·reason·confidence는 정확히 비교한다.
순서 반전·반복 실행·원본 불변·정정 후 재계산도 검증한다.
clip과 shrinkage로 유한 표본의 rawScore는 0/100에 도달하지 않으며 골든 최대 표시 점수도 100 미만이다.

확인 명령: `node_modules/.bin/vitest run tests/unit/momentum.test.ts tests/unit/momentum-golden.test.ts`.
화면 변경은 없으며 실제 API/UI의 model_pending은 유지한다. 공개 연결은 후속 계약 검토 단계다.

### 후속 실행 검증 (2026-11-03)

- `node_modules/.bin/vitest run`: 11개 파일, 173개 테스트 통과. momentum 기존 75개와 골든/계약/역할분리 후속 16개를 포함한다.
- 변경 계산·fixture·테스트 파일 대상 strict TypeScript 검사와 ESLint `--max-warnings=0` 통과.
- `node_modules/.bin/tsc --noEmit`: 기존 `prisma.config.ts(1,30)`의 `prisma/config` 모듈 부재로 실패. 패키지 설치 없이 유지하며 전체 타입 검사 통과로 보고하지 않는다.
- 브라우저/E2E/build는 미실행: API·화면·Next.js 경로를 변경하지 않은 계산 단계다. 화면으로 점수를 확인하는 연결은 아직 제공하지 않는다.
