# 공개 REST API 계약 v1

기준일: 2026-11-03 (Asia/Seoul). ADR-009 채택 설계. **아직 서버·Zod·OpenAPI·테스트 구현 없음.** [데이터 사전](DATA_DICTIONARY.md)의 정의를 정규 의미로 사용한다. 예시는 모두 가상 DEMO이며 실제 선수 기록/실제 sync 결과가 아니다. 이 문서는 외부 API에 대한 접근 승인이 아니다.

## 1. 경계·권한·버전

- base `/api/v1`, 아래 8종은 GET 읽기 전용·비로그인 공개다. JSON UTF-8, 성공 200, 미지원 method 405와 `Allow: GET`. 공개 API로 수입·게시·권리 승인·mode 변경을 수행하지 못한다.
- 서버가 활성 mode를 결정한다. 현재 DEMO. `mode=APPROVED` 요청 같은 미정의 파라미터는 400. APPROVED는 별도 승인/ADR/출시 게이트 이후에만 서버 설정으로 가능하며 DEMO/APPROVED를 한 응답에 섞지 않는다.
- 매 요청마다 release의 현재 소스 권리·field allowlist·시즌·대회를 검사한 뒤 DTO를 만든다. 권리 없는 historical release/cursor도 접근 차단한다. 원본·hash·계약 증빙·내부 키·관리자·세션·개인정보는 응답하지 않는다. 공개되지 않은 batch/player 존재도 노출하지 않는다.
- 인증 미구현 관리자는 서버 기본 거부. 기존 아키텍처의 `/api/v1/admin/*`는 별도 쓰기 계약 대상이며 이 8개 GET으로 대체하지 않는다. 관리자 API는 인증 없음 401, 권한 없음 403, CSRF/Origin·권리 검사·no-store가 필수다.
- URL major는 호환성 경계, meta.schemaVersion=`1.0.0`은 응답 DTO 버전이다. 기존 필드 제거/타입·null 의미·기간 변경은 v2. 추가 필드는 명세·소비자 검증 갱신 후 minor(소비자는 응답의 새 필드를 허용). **서버 입력은 strict unknown-key 거부**다. 점수 모델 버전은 API 버전과 별개다.
- 권리 철회 캐시 노출을 방지하기 위해 v1 응답은 모두 `Cache-Control: no-store`. Service Worker/브라우저 영속 수치 캐시 금지. 네트워크 단절 시 메모리의 DEMO 결과만 과거 조회로 표시 가능; APPROVED는 재검증 불가 시 수치를 숨긴다. ETag/304는 v1 미지원.

## 2. 파라미터와 고정 scope

이하 S(공통 scope)를 허용한다고 명시한 endpoint에만 해당 쿼리를 보낸다. scalar 중복(예: season 두 번), 빈 값, 배열 강제 변환, 미지정 query, 잘못된 UTF-8은 400. GET body는 허용하지 않는다.

| S 필드 | 타입/허용값·기본값·검증 |
| --- | --- |
| season | 십진 정수 연도 1900~9999, `2026` 형식. 생략 시 공개 DEMO/승인 데이터의 가장 큰 year. 선택 연도와 정규시즌 배치가 없으면 다른 대회로 자동 전환하지 않음 |
| competition | regular / postseason, 기본 regular. 시즌·대회는 항상 분리 |
| role | batter / starter / reliever. players 목록과 선수 identity 상세만 생략 가능(모든 소개 role). 기록/통계/기세/랭킹/비교는 필수, 자동 주역할 추정 금지 |
| teamId | ID, 생략은 all(쿼리에서 문자 `all`은 허용 안 함). 해당 팀으로 출전한 기록만 집계, 등록 목록에서는 snapshot 소속. 선택된 배치에 없는 팀이면 422 |
| cutoffAt | 사전의 Instant. 생략=release 배치 asOf; `≤asOf`, 시즌 starts_on KST 00:00 이상. 초과/시즌 밖은 422. roster는 cutoff KST 날짜까지 관측분 사용 |
| releaseId | ID, 생략 시 해당 scope 활성 release를 한 번 읽어 고정. 지정 시 season/competition/mode 일치 필수(불일치 409). season/competition 생략 시 release가 정함 |

활성 데이터가 전혀 없으면 `/meta`만 dataStatus=no_published_data로 200, 나머지는 503 DATASET_UNAVAILABLE. 존재하지 않는 시즌/대회 요청은 422 UNSUPPORTED_SCOPE, 존재하나 일치 항목 없는 검색은 200 빈 배열. 요청 scope 해석값은 항상 meta.scope에 반환한다. 사용자는 meta의 정확한 시즌·대회·release를 후속 URL에 유지한다.

최초 목록/상세가 release를 고정한다. cursor는 고정된 release와 cutoff 및 필터/sort를 포함한다. cursor 사용 시 동일 파라미터를 전부 다시 보내야 하며 releaseId만 생략 가능(서버가 cursor에서 복원). 필터 변경은 cursor를 버린 첫 요청이다. 활성 release가 바뀌어도 기존 공개 release는 동일 결과를 제공한다. 철회되거나 더 이상 제공 불가한 release는 410 RELEASE_UNAVAILABLE(미공개/추측 ID는 404 NOT_FOUND). 서버는 응답 안에서 새 배치를 섞거나 자동 재시도하지 않는다. 서로 다른 release 비교는 409.

### 목록 P와 정렬

범위를 벗어난 limit/n과 숫자 타입 문법 오류는 400 VALIDATION_ERROR, window=season에 n을 보낸 의미 오류는 422 INVALID_WINDOW다.

`limit`: 1~20 정수, 기본 20. `cursor`: 서버 서명 base64url 불투명 토큰, 최대 2048자; offset/page는 미지원. 토큰은 releaseId, 정규화 query hash, cutoffAt, sort, 마지막 정렬 tuple(랭킹은 마지막 raw score·ID와 동점 순위 상태)을 결합한다. 변조/필터 변경 400 INVALID_CURSOR. cursor 자체 TTL 없음; release 권리·가용성은 매번 검사. 동일 release 내용은 불변이다.

`page`는 `{limit,nextCursor,hasMore}`. 마지막 페이지 nextCursor=null/hasMore=false. 중복/건너뛰기 없이 안정 정렬한다. 이름 정렬은 NFC Unicode code point(브라우저 locale 정렬 금지), 마지막 tie-break playerId ASCII 오름차순. 원점수 동률은 1,1,3 경쟁 순위, 반올림 동점으로 순위를 합치지 않는다.

## 3. 공통 응답 타입

성공은 `{data,meta,page?}`, 오류는 `{error,meta}`. object는 표의 모든 필드를 포함하고 nullable만 null이다. 목록은 항상 배열. 수치 문자열 금지. 모든 시간·ID 규칙은 데이터 사전과 같다.

| meta 필드 | 타입·의미 |
| --- | --- |
| schemaVersion / requestId | `1.0.0` / 안전한 추적 ID 문자열(1~64자) |
| mode / demo | DEMO 또는 APPROVED / Bool(mode=DEMO와 정확히 일치) |
| dataStatus | available / no_published_data |
| releaseId / revision / batchId | ID? / 양의 정수? / ID?; 배치 없을 때만 null |
| scope | `{season:int?,competition:enum?,role:enum?,teamId:ID?,cutoffAt:Instant?}`; null role=미선택, null team=전체. meta 무배치 scope 미해석 필드만 null |
| asOf / importedAt / lastSuccessfulSyncAt | Instant? 각 1개. 무배치일 때 null, 그 외 필수. lastSuccessfulSyncAt은 검증된 배치 **게시 성공 시각**; DEMO는 fixture 게시이며 외부 sync 아님 |
| syncKind / syncStatus | fixture_publish 또는 approved_import / success 또는 unknown. 데이터 없을 때 syncKind=null, syncStatus=unknown. 실패한 최근 시도는 lastSuccessfulSyncAt을 덮어쓰지 않음; 성공 표시는 최신 시도 성공을 뜻하지 않음 |
| sources | Source[]; 현재 v1 배치당 1개. 무배치 [] |
| scoreVersion / modelStatus | 채택 model ID? / pending 또는 adopted. 미확정이면 null/pending |
| warnings | `{code,message}`[]; 없으면 []. 고정 code 예: PARTIAL_DATA, SHORT_WINDOW, ROSTER_UNKNOWN. message는 안전한 한국어 |

Source: `{sourceId,rightsRecordId,name,attribution,publicUrl,asOf,mode,approvalStatus}`. publicUrl만 nullable. approvalStatus는 노출 가능한 경우 approved만. DEMO 자체 제작 승인이라고 attribution에서 밝히며 실제 데이터 승인으로 해석하지 않는다.

재사용 DTO:

| 타입 | 필수 필드·타입 |
| --- | --- |
| Player | `playerId:ID,displayName:string,listedRoles:Role[],roster:Roster,seasonAppearanceCount:int≥0,seasonTeams:{teamId:ID,name:string}[]` |
| Roster | `status:registered\|unregistered\|unknown,snapshotOn:Date?,effectiveOn:Date?,teamId:ID?,uniformNumber:string?,reason:string?` (사유 없으면 null) |
| Sample | `requestedN:int?,availableN:int≥0,completeWindow:bool,startDate:Date?,endDate:Date?,gameIds:ID[]` (시즌 requestedN=null/completeWindow=true, 0경기는 날짜 null) |
| Metric | `value:number?,unit:string,status:complete\|missing_data\|zero_denominator\|not_applicable,knownSubtotal:number?,knownRows:int≥0,totalRows:int≥0,sourceIds:ID[]` |
| Window | `kind:season\|recent\|previous,n:int?,sample:Sample,metrics:metricName→Metric` |
| Momentum | `playerId,evaluationRole,status,value:number?,previousValue:number?,delta:number?,scoreVersion:ID?,requestedN:int?,minimumSample:object?,sample:Sample?,previousSample:Sample?,previousStatus:status?,lastAppearanceOn:Date?,daysSinceLastAppearance:int?,explanation:string[]` |

Player의 seasonAppearanceCount는 선택 cutoff/팀/role의 확정 경기 수다. role 생략 시 투타 겸업도 distinct gameId로 한 경기를 한 번만 센다. seasonTeams는 동일 조건에서 출전한 팀들의 teamId ASCII 오름차순 배열이며, 등록 팀과 독립이다. 0출전이면 []다.

Metric의 sourceIds는 원천 추적성이다. `knownSubtotal`은 missing_data인 합계 지표에만 알려진 행 합(없으면 null), rate/complete/비해당은 null. totalRows는 선택된 출전 수, knownRows는 해당 metric에 필요한 입력이 완비된 행 수. missing_data가 zero_denominator보다 우선한다. 출전 0일 때 count는 0/complete, rate는 null/zero_denominator. 상세·통계·랭킹·비교에도 각 선수별 Sample을 포함한다.

Momentum status는 model_pending/ready/insufficient_sample/missing_data/no_appearances. 모델 미확정이면 값/변화/모델 N/minimumSample/sample/previousSample/previousStatus=null, 설명에 미확정 표시. lastAppearanceOn/daysSinceLastAppearance는 기록으로 계산 가능. ready 외 score는 null, 이전 실패 시 현재 value 유지하되 delta/previousValue=null. minimumSample은 모델의 역할별 기준을 그대로 공개한다.

## 4. Endpoint

| GET 경로 | query / data / 동작 |
| --- | --- |
| `/api/v1/players` | S+P+`q,membership,sort`. q: NFC trim 1~100 code point 부분 이름 검색(미지정 전체); membership=appeared(기본)/registered/all. appeared는 cutoff 이전 final 출전 1회 이상, role 선택 시 그 role; registered는 관측상 registered만(0출전 허용), all은 배치 전체 선수. role 필터는 registered/all에선 listedRoles 기준임을 응답 warnings로 명시. teamId는 appeared면 경기 소속, registered/all이면 snapshot 소속(unknown은 불일치). sort=name_asc(기본)/name_desc만. data=Player[] |
| `/api/v1/players/:id` | S. 공개 배치에 player가 있으면 0출전도 200. data=`{player:Player,availableRoles:Role[],lastAppearanceOn:Date?,daysSinceLastAppearance:int?}`; availableRoles는 확정 기록이 있는 role들, listedRoles와 구분. 없는/미공개 ID는 404 |
| `/api/v1/players/:id/gamelog` | S(role 필수)+P+`sort`(completed_desc 기본/completed_asc). data=GameLog[]. 시즌 안의 해당 role 기록만, N 제한 없이 cursor 페이지. game status는 final만. cancelled/suspended는 표본에 넣지 않으며 일정 API로 가장하지 않음 |
| `/api/v1/players/:id/stats` | S(role 필수)+`window`(season 기본/recent/previous)+`n`(1~100). n은 recent/previous만 허용, 기본 batter=10/starter=5/reliever=10. data=`{playerId,evaluationRole,window:Window,lastAppearanceOn,daysSinceLastAppearance,usage:Usage?}`. 팀/role/확정 필터 후 N 선택 |
| `/api/v1/players/:id/momentum` | S(role 필수)만, 임의 n/모델 변경 금지. data=Momentum. 미확정/표본 부족도 200, 수치 날조 금지 |
| `/api/v1/rankings` | S(role 필수)+P+`sort`(score_desc 기본만 허용). 모델의 최근 구간 기세, minimumSample 충족 ready 선수만 data=`{entries:RankEntry[],excludedCounts:{noAppearances,missingData,insufficientSample},rankingStatus:ready\|model_pending}`. 모델 미확정이면 entries=[], excludedCounts 각 0(모델 평가 안 함), rankingStatus=model_pending. 상태별 제외 수는 상호 배타적. 낮은 점수를 부족 표본으로 바꾸지 않음 |
| `/api/v1/compare` | S(role 필수)+`playerIds`=쉼표로 구분한 서로 다른 ID 정확히 2개+`window,n`(stats와 동일, 기본 recent). 같은 scope/release/model에서 data=Compare. 순서는 요청 순서. 0/1/3명·중복·다른 역할·모델 혼합 422. 선수별 결측/0출전은 실패가 아닌 정상 상태. listedRoles 또는 해당 role 출전 둘 다 없으면 ROLE_MISMATCH |
| `/api/v1/meta` | season/competition/releaseId만 허용. data=MetaCatalog. 지원 시즌/대회·필터 선택지·출처·모델 정책·공개 상태 제공; 공통 meta 동일. role/team/cutoff 입력은 거부 |

GameLog: `{gameId,playedOn,completedAt,doubleheaderNo,recordRevision,status:"final",teamId,opponentTeamId,playerId,role,gs:int?,counts:object,missingFields:map,sourceIds:ID[],asOf}`. 타격 gs=null, 투구 gs=0/1. counts의 모든 타격 필드는 `pa,ab,h,doubles,triples,hr,bb,hbp,ibb,so,sf,sac,r,rbi,sb,cs,tb`; 투구는 `bf,outsRecorded,h,er,r,bb,ibb,hbp,so,hr,np,gs,sv,hld`. count 값과 null 의미는 사전 그대로. gs는 top level과 counts가 일치해야 한다. 동일 completedAt이면 gameId ASCII 오름차순(asc/desc 모두)이다.

Stats metrics는 타격일 때 위 18 counts + `g,avg,obp,slg,ops`, 투구일 때 위 14 counts + `appearances,era,whip,kPer9,bbPer9`를 **모두** 포함한다. count unit은 사전의 사건 단위, 비율 unit은 AVG/OBP/SLG/OPS=`ratio`, ERA=`runs_per_9_innings`, WHIP=`baserunners_per_inning`, K/9=`strikeouts_per_9_innings`, BB/9=`walks_per_9_innings`. 이닝은 outsRecorded에서 표시하며 소수 innings 필드를 만들지 않는다. GS/SV/HLD는 집계 시 0~G의 count다.

공개 Metric unit은 고정 enum이다: `g,appearances` → `appearances`, `pa` → `plate_appearances`, `ab` → `at_bats`, `h` → `hits`, `doubles` → `doubles`, `triples` → `triples`, `hr` → `home_runs`, `bb` → `walks`, `hbp` → `hit_by_pitch`, `ibb` → `intentional_walks`, `so` → `strikeouts`, `sf` → `sacrifice_flies`, `sac` → `sacrifice_bunts`, `r` → `runs`, `rbi` → `runs_batted_in`, `sb` → `stolen_bases`, `cs` → `caught_stealing`, `tb` → `total_bases`, `bf` → `batters_faced`, `outsRecorded` → `outs`, `er` → `earned_runs`, `np` → `pitches`, `gs` → `starts`, `sv` → `saves`, `hld` → `holds`. 투구 H/HR/BB 등은 같은 사건 unit이며 evaluationRole로 허용/기록 주체를 구별한다. 비율 unit은 위에 정의했다.

Usage(불펜만): `{basis:"completed_date_kst",sevenDays:{appearances:int,outsRecorded:Metric},fourteenDays:{appearances:int,outsRecorded:Metric},consecutiveDays:int}`. 7/14일 사용량은 window 선택과 무관하게 같은 cutoff의 달력 구간이다. 다른 role은 usage=null.

RankEntry: `{rank:int≥1,player:Player,momentum:Momentum,sample:Sample}`. 동점은 raw 모델 값 비교, ID 안정 정렬. 순위는 페이지 내 번호가 아닌 전체 순위다. 제외 선수 안내는 excludedCounts와 players 탐색 링크로 제공하며 검증되지 않은 점수순으로 섞지 않는다.

Compare: `{comparisonStatus:complete|partial,items:[{playerId,status:"ok",stats:StatsData,momentum:Momentum}|{playerId,status:"error",error:{code,message}}]}`. 2명 모두 공개 선수임을 먼저 검사해 아니면 전체 404. 역할/요청 오류는 전체 422, release 충돌은 전체 409. 검증 이후 한 선수 계산만 실패하면 200 partial로 해당 item error=COMPUTATION_UNAVAILABLE; 둘 다 실패하면 503. 결측·부족 표본·model_pending은 status=ok. 동일 role이라도 양쪽 scoreVersion이 일치하지 않으면 전체 409 MODEL_VERSION_MISMATCH; 서버가 버전을 임의 보정하지 않는다.

MetaCatalog: `{dataStatus,defaultScope:{season:int?,competition:"regular"},scopes:[{season,competition,releaseId}],teams:[{teamId,name}],roles:["batter","starter","reliever"],statisticsWindows:{batter:10,starter:5,reliever:10,maxN:100},model:{status,scoreVersion,roles:object?},limits:{maxLimit:20,maxCompare:2,maxQueryLength:100},sources:Source[]}`. teams/sources/model은 선택 release 기준. 무배치면 default season=null, scopes/teams/sources=[], 모델 pending/null. 한 scope 요청이 다른 scope 데이터까지 집계하지 않는다.

## 5. 예시 JSON

아래 timestamp·이름·ID는 설명용 가상값이다. HTTP 예시는 서버 호출 결과가 아니다. 반복 DTO는 위 표를 따르며 첫 예시는 **완전 응답**이다.

`GET /api/v1/players?season=2026&competition=regular&role=batter&limit=20`

```json
{
  "data": [
    {
      "playerId": "demo_player_001",
      "displayName": "가상 타자 하나",
      "listedRoles": ["batter"],
      "roster": {
        "status": "registered",
        "snapshotOn": "2026-11-01",
        "effectiveOn": "2026-11-01",
        "teamId": "demo_team_a",
        "uniformNumber": "00",
        "reason": null
      },
      "seasonAppearanceCount": 1,
      "seasonTeams": [{"teamId": "demo_team_a", "name": "가상 팀 가"}]
    }
  ],
  "meta": {
    "schemaVersion": "1.0.0",
    "requestId": "demo_request_001",
    "mode": "DEMO",
    "demo": true,
    "dataStatus": "available",
    "releaseId": "demo_release_001",
    "revision": 1,
    "batchId": "demo_batch_001",
    "scope": {
      "season": 2026,
      "competition": "regular",
      "role": "batter",
      "teamId": null,
      "cutoffAt": "2026-11-01T12:00:00.000Z"
    },
    "asOf": "2026-11-01T12:00:00.000Z",
    "importedAt": "2026-11-01T12:05:00.000Z",
    "lastSuccessfulSyncAt": "2026-11-01T12:10:00.000Z",
    "syncKind": "fixture_publish",
    "syncStatus": "success",
    "sources": [
      {
        "sourceId": "demo_source_synthetic",
        "rightsRecordId": "demo_rights_001",
        "name": "자체 가상 fixture",
        "attribution": "DEMO · 자체 제작 가상 데이터, 실제 기록 아님",
        "publicUrl": null,
        "asOf": "2026-11-01T12:00:00.000Z",
        "mode": "DEMO",
        "approvalStatus": "approved"
      }
    ],
    "scoreVersion": null,
    "modelStatus": "pending",
    "warnings": []
  },
  "page": {"limit": 20, "nextCursor": null, "hasMore": false}
}
```

다음은 각 endpoint의 **data 값만** 보인 JSON이다. 실제 응답에는 위 공통 meta를 반드시 붙인다. gamelog는 page도 붙인다.

`GET /api/v1/players/demo_player_001?releaseId=demo_release_001&role=batter`의 data:

```json
{
  "player": {
    "playerId": "demo_player_001",
    "displayName": "가상 타자 하나",
    "listedRoles": ["batter"],
    "roster": {"status": "registered", "snapshotOn": "2026-11-01", "effectiveOn": "2026-11-01", "teamId": "demo_team_a", "uniformNumber": "00", "reason": null},
    "seasonAppearanceCount": 1,
      "seasonTeams": [{"teamId": "demo_team_a", "name": "가상 팀 가"}]
  },
  "availableRoles": ["batter"],
  "lastAppearanceOn": "2026-11-01",
  "daysSinceLastAppearance": 0
}
```

`GET /api/v1/players/demo_player_001/gamelog?releaseId=demo_release_001&role=batter`의 data:

```json
[
  {
    "gameId": "demo_game_001",
    "playedOn": "2026-11-01",
    "completedAt": "2026-11-01T11:00:00.000Z",
    "doubleheaderNo": 0,
    "recordRevision": 1,
    "status": "final",
    "teamId": "demo_team_a",
    "opponentTeamId": "demo_team_b",
    "playerId": "demo_player_001",
    "role": "batter",
    "gs": null,
    "counts": {"pa": 4, "ab": 3, "h": 1, "doubles": 1, "triples": 0, "hr": 0, "bb": 1, "hbp": 0, "ibb": 0, "so": 1, "sf": 0, "sac": 0, "r": 0, "rbi": 0, "sb": 0, "cs": 0, "tb": 2},
    "missingFields": {},
    "sourceIds": ["demo_source_synthetic"],
    "asOf": "2026-11-01T12:00:00.000Z"
  }
]
```

`stats`의 metrics는 공간상 아래 **발췌**만 보인다(실제 반환은 23개/19개 전부 필수). 이 예시의 최근 N=10은 통계 조회 기준이며 모델 N이 아니다.

```json
{
  "playerId": "demo_player_001",
  "evaluationRole": "batter",
  "window": {
    "kind": "recent",
    "n": 10,
    "sample": {"requestedN": 10, "availableN": 1, "completeWindow": false, "startDate": "2026-11-01", "endDate": "2026-11-01", "gameIds": ["demo_game_001"]},
    "metrics": {
      "pa": {"value": 4, "unit": "plate_appearances", "status": "complete", "knownSubtotal": null, "knownRows": 1, "totalRows": 1, "sourceIds": ["demo_source_synthetic"]},
      "ops": {"value": 1.1666666666666667, "unit": "ratio", "status": "complete", "knownSubtotal": null, "knownRows": 1, "totalRows": 1, "sourceIds": ["demo_source_synthetic"]}
    }
  },
  "lastAppearanceOn": "2026-11-01",
  "daysSinceLastAppearance": 0,
  "usage": null
}
```

`momentum`의 data(모델 미확정의 정상 응답):

```json
{
  "playerId": "demo_player_001",
  "evaluationRole": "batter",
  "status": "model_pending",
  "value": null,
  "previousValue": null,
  "delta": null,
  "scoreVersion": null,
  "requestedN": null,
  "minimumSample": null,
  "sample": null,
  "previousSample": null,
  "previousStatus": null,
  "lastAppearanceOn": "2026-11-01",
  "daysSinceLastAppearance": 0,
  "explanation": ["모델 미확정: 점수·변화·순위를 산출하지 않습니다."]
}
```

`rankings`의 data:

```json
{"entries": [], "excludedCounts": {"noAppearances": 0, "missingData": 0, "insufficientSample": 0}, "rankingStatus": "model_pending"}
```

compare의 개별 실패 item 예시(단독 발췌, 실제 items는 정확히 2개, 성공 item은 위 StatsData/Momentum 전체):

```json
{"playerId": "demo_player_002", "status": "error", "error": {"code": "COMPUTATION_UNAVAILABLE", "message": "선수 기록 계산을 완료하지 못했습니다. 다시 시도해 주세요."}}
```

무배치 `/meta`의 data:

```json
{
  "dataStatus": "no_published_data",
  "defaultScope": {"season": null, "competition": "regular"},
  "scopes": [],
  "teams": [],
  "roles": ["batter", "starter", "reliever"],
  "statisticsWindows": {"batter": 10, "starter": 5, "reliever": 10, "maxN": 100},
  "model": {"status": "pending", "scoreVersion": null, "roles": null},
  "limits": {"maxLimit": 20, "maxCompare": 2, "maxQueryLength": 100},
  "sources": []
}
```

## 6. 오류·검증

오류 meta는 `{schemaVersion,requestId}`만 포함한다(권리 없는 release 메타데이터 노출 금지). error는 `{code,message,details:[{path,code,message}],retryable:bool}`. details는 검증 경로·원인만, 원본 입력/스택/SQL/비밀 제외. path는 `query.limit`, `path.id` 같은 문자열. 내부 오류 details=[]; 429/503은 가능한 경우 `Retry-After` 정수 초를 보낸다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 조건을 확인해 주세요.",
    "details": [{"path": "query.limit", "code": "out_of_range", "message": "limit는 1~20 정수입니다."}],
    "retryable": false
  },
  "meta": {"schemaVersion": "1.0.0", "requestId": "demo_request_error_001"}
}
```

| HTTP | code·처리 |
| --- | --- |
| 400 | VALIDATION_ERROR / INVALID_CURSOR: 문법·type·미지정 key·enum·limit·검색 길이 오류. 자동 재시도 안 함 |
| 401/403 | UNAUTHENTICATED / FORBIDDEN: 관리자만. 공개 endpoint에 관리자 로그인 요구 금지 |
| 404 | NOT_FOUND: 선수/미공개 release 미존재, 다른 scope의 선수도 해당 배치에 없으면 404 |
| 405 | METHOD_NOT_ALLOWED: 읽기 외 동작 차단 |
| 409 | SCOPE_MISMATCH / MODEL_VERSION_MISMATCH: release/scope/model 혼합. 조건 재선택 |
| 410 | RELEASE_UNAVAILABLE: 이전 공개 release 철회/제공 종료. 최신 조회는 사용자 동작으로 cursor 제거 후 수행 |
| 422 | UNSUPPORTED_SCOPE / INVALID_CUTOFF / INVALID_WINDOW / INVALID_COMPARISON / ROLE_MISMATCH: 문법은 맞지만 의미 불가 |
| 429 | RATE_LIMITED: Retry-After 이후 수동/제한된 재시도, 무한 루프 금지. 실제 rate 한도는 P5 운영 결정 전 미설정 |
| 500 | INTERNAL_ERROR: 안전한 메시지+requestId, retryable=false |
| 503 | DATASET_UNAVAILABLE / COMPUTATION_UNAVAILABLE: retryable=true, 기존 데이터 보존. fixture에서 인위적 실패로 검증 |

구현 순서: (1) path/query strict parse, 명시적 숫자 변환(정규식 정수만), NFC 정규화·중복 검사 → (2) release scope 고정·현재 권리 검사 → (3) composite FK와 cutoff/role/window 검증 → (4) 서비스 계산 → (5) 공개 DTO allowlist·응답 스키마 검증. Zod 실패는 게시 전 입력이면 거부, 서버 DTO 실패는 500이며 잘못된 JSON을 200으로 내보내지 않는다.

## 7. 필수 계약 테스트 (아직 미실행)

- 8종 endpoint 성공/미존재/잘못된 role·시즌·날짜·필수값/미정의 key·scalar 중복·한계 0/1/20/21, query 100/101자 검사.
- cursor 2페이지 동점·이름 중복·더블헤더·새 게시·필터 변경·변조·철회. 정렬 순서 안정 및 누락/중복 0.
- 최근 10 **출전** 대 팀 10경기, GS 전환, 정규/포스트 분리, team별 시즌 합 일치, cutoff 이후 데이터 제외.
- null/0분모/부분 결측/미등록·unknown/미출전·모델 pending·최소 표본 경계, raw 동점 1,1,3·반올림 동점 차이.
- compare 0/1/2/3명·중복·다른 role·version·한쪽/양쪽 계산 실패, 공개 필드 이외 노출 0.
- 승인 미확인·만료·철회·실제/가상 혼합·과거 release·브라우저 cache 차단. 관리자 미인증/권한 없음 직접 요청 거부.

문서 JSON parse 확인은 위 동작을 검증한 앱 테스트가 아니다. P2에서 이 계약을 실행 스키마·fixture로 옮기고 P4에서 실제 HTTP/DB/화면 통합으로 검증한다.

## 2026-11-03 실행 가능한 단계 계약 (기존 설계 중 일부)

현재 구현은 GET `/api/v1/meta`, `/players`, `/players/:id`에 한정된다. 위 전체 API 설계의 완료를 뜻하지 않는다. 이 단계의 응답은 `{data,meta,pagination,error}`이며 오류는 data/meta/pagination=null이다. 오류 코드는 BAD_INPUT, NOT_FOUND, DATA_UNAVAILABLE, STALE_DATA, FORBIDDEN, RATE_LIMITED, INTERNAL_ERROR로 통일한다. 마지막 네 코드의 실제 권한/제한/신선도 정책은 아직 활성화되지 않았다.

scope는 season(기본 2026), competition(기본 regular). 목록은 role, q, sort(name_asc/name_desc), limit(1~20), 서명 cursor만 추가 허용한다. 미지원 teamId/membership/cutoffAt/releaseId 등은 조용히 무시하지 않고 400으로 거부한다. 중복 query도 거부한다. fixture는 불변 demo_fixture_v1이며 커서는 동일 scope/필터/정렬/limit에 묶인다. 프로세스 재시작 후 커서는 무효화되므로 첫 페이지부터 다시 조회한다.

실행 DTO는 `src/contracts/api.ts`가 기준이다. 선수는 playerId/displayName/listedRoles/sourceId/sampleSize=0만 제공한다. 가상 identity fixture이며 출전/등록/통계가 아니다. meta의 asOf/lastUpdatedAt은 fixture 제작 시각이고 외부 수집 성공 시각이 아니다. DB 없는 DEMO에서 실제 서비스가 읽는 저장소 메타데이터를 그대로 보고한다.

### DEMO v2 구현 보충 (2026-11-03)

성공 meta에 `demo: true`를 추가한다. 선수 `sampleSize`는 0 고정에서 0 이상 정수로
확장했고 `teamId`, `stats`를 추가했다. 기존 필드는 유지한다. stats는 타수(ab), 안타(h),
홈런(hr), 득점/실점(r), 타점(rbi), 삼진(so), 타석(pa), 볼넷(bb), 투구 아웃 수(outsRecorded),
자책점(er), 상대 타자(bf)의 비음수 정수 합계다. 역할에 해당하지 않는 값은 0이며
기세 점수로 사용하지 않는다. 경기 표본은 sampleSize, 시즌/대회/기준시각은 공통 meta,
출처는 sourceId에 있다. releaseId=synthetic_v2. DEMO DB 초기화/미생성/무결성 실패는
503 DATA_UNAVAILABLE이며 seed 전 데이터를 fallback으로 제공하지 않는다.

### 날짜별 DEMO 조회

`GET /api/v1/scope?season=2026&competition=regular&date=2026-10-31&search=registered`

competition: regular(기본), postseason, allstar, exhibition. search: appeared(기본), registered.
q는 선수명 검색이다. date는 유효한 YYYY-MM-DD KST 날짜이며 기본은 KST 오늘이다.
season 기본은 KST 현재 연도이며 미제공 시즌은 빈 데이터로 응답한다.
rosterSnapshots/teamHistory와 games/gameLogs를 구분한다. currentRoster는 최신 스냅샷의 유효기간과
UNKNOWN 여부를 확인한 경우만 반환한다. rosterStatus=NO_ENTRY_INFORMATION이면 등록 검색 결과는 빈 배열이다.
players는 lastAppearanceDate, sampleSize, dataAsOf를 포함한다. 모든 기록은 batchId/sourceId/licenseId를 유지한다.
policy는 staleThresholdHours, 비활성 scheduler, 미연결 alert를 제공한다.
pipeline은 runs(검증/게시 단계·실패 이유), lastAttempted, lastSuccessful(게시 완료)을 제공한다.
이 응답은 DEMO이며 실시간 제공을 의미하지 않는다. 자세한 시점·마이그레이션 정책은 ADR-SCOPE-01 참조.

## DEMO 기세 API — ADR-017

- `GET /api/v1/players/:id/momentum?role=hitter&window=10&season=2026&competition=regular`
- `GET /api/v1/rankings?role=starter&window=5&sort=change&season=2026&competition=regular`

role은 hitter|starter|reliever 중 하나를 반드시 지정한다. window는 3|5|10|20이며 생략 시 선발은 5, 나머지는 10이다. 타자는 최근 타격 출전 경기 수, 선발은 최근 선발 등판 수, 불펜은 최근 구원 등판 수다. competition은 regular|postseason만 허용한다. 중복/알 수 없는 쿼리와 잘못된 창·정렬은 400, scope에 없는 선수는 404다.

랭킹 HTTP 요청은 `page`(기본 1, 최대 99999), `limit`(기본·최대 20)을 받는다. 응답에 `{page,limit,total,excludedTotal,hasMore}` pagination이 추가되며 data와 excluded를 각각 같은 페이지 구간으로 제한한다. excluded도 끝까지 순회하도록 hasMore는 두 목록 중 긴 쪽을 기준으로 한다. 안정적인 playerId 동률 정렬을 유지한다. 선수별 momentum 응답은 변경하지 않는다.

응답은 `{data, excluded, meta, pagination?, error:null}`이다. 선수 조회 data에는 요청 역할 결과(없으면 빈 배열)가 들어가며 랭킹 data는 해당 역할만의 순위다. excluded는 미산출·낮은 신뢰도·비등록/미상 로스터 또는 change 비교 대상 부재 선수다. score/deltaScore는 null을 0으로 대체하지 않는다. rankingStatus와 eligibility.reason, previousSnapshotId를 함께 확인한다.

각 스냅샷의 sourceIds, inputRefs(행 키·배치·라이선스), asOf, computedAt, season/competition, sampleSize와 explanation의 출처·기준일을 수치 및 설명과 함께 표시해야 한다. meta.demo=true/sourceMode=DEMO이며 공식 선수 기록으로 표시할 수 없다. 기존 공개 페이지의 model_pending 표시는 이 API 도입만으로 변경되지 않는다.

## GET /api/v1/home (DEMO fixture 전용)

쿼리: `role=batter|starter|reliever` (기본 batter), `window=3|5|10|20` (기본 10).
알 수 없는 필드·중복 쿼리·잘못된 기간은 400. DB 미준비는 503. 응답은 `Cache-Control: no-store`.

성공 응답은 `src/contracts/home.ts`의 `homeResponse`로 검증한다. `demo`, `season`, `competition`, `asOf`, `lastUpdatedAt`, `lastGame`, `source`, `model`, `window`와 역할별 `players`를 반환한다. 각 선수는 ID·이름·팀·원천 ID·기간 내 표본·최종 출전일·nullable 점수·신뢰도·산출 상태를 포함한다. 홈 클라이언트는 이 응답만으로 검색·정렬·선정하며 점수·기록을 하드코딩하지 않는다. 기존 선수 상세 ID와 동일하다. 공식 게시 데이터 및 기존 rankings API와는 별도이다.

## 투수 상세 DEMO API

`GET /api/v1/players/:id/pitching?role=starter&window=5`

- role: starter/reliever, 기본 starter. window 기본 10. 선발 3/5/10/season, 불펜 5/10/20/season만 허용하며 중복/미지원 쿼리는 400이다.
- season: 모든 투구 역할 시즌 통계. roleSeason: 선택 역할 시즌 통계. recent: 선택 역할의 최근 N등판 또는 역할 시즌 통계. 각 집계에 totals/sample/metrics/inningsDisplay 포함.
- games: 선택 역할 로그(시간순), 원시 outs/R/ER/H/BB/SO/HR, 상대팀, 역할, IP, 개인 결과(현재 미제공), source/inputRef/asOf. doubleheader 순서 포함.
- availableRoles, momentum, scoreEvidence(역할 baseline 중앙값/선수 수/사용 가능 여부, 표본 수축 및 기여), modelVersion/source/asOf/updatedAt/seasonYear/competition 제공.
- pitches는 선택 표본 전부에 원시 값이 있을 때만 합계 유효. 현재 fixture에는 미제공. HLD/SV도 결측이며 0 대체 없음.
- 성공 200, 선수 없음 404, 잘못된 입력 400, canonical DEMO store 미준비 503. 공개 DEMO read-only이며 Cache-Control: no-store. 기존 타자 상세 API는 유지한다.

## 상세 차트·로그 추가 계약

타자 batting과 투수 pitching 상세 응답에 `exportPolicy: {demo, exportAllowed, licenseId}` 추가. 현재 canonical DEMO만 허용한다. 타자 games에 경기 당시 소속을 기준으로 찾은 opponent, 투수 games에 stats/cumulative/moving 추가. 모든 집계는 기존 battingStats/pitchingStats를 사용하며 이동 구간은 선택 기간 안의 최대 5출전이다. id/date/order/counts/source/inputRef와 기존 투수 ip/result/role은 유지한다. DB 마이그레이션은 없으며 계약 추가는 `tests/unit/game-analysis.test.ts`로 검증한다.


### R05 채택 규칙 (ADR-030, 기존 상충 설명 대체)

원값(저장된 score/deltaScore의 정확한 수치)으로 정렬·동점을 판정한다. score는 내림차순(0 포함), change는 deltaScore > 0만 내림차순, decline은 deltaScore < 0만 오름차순이다. 0 변화와 null 변화는 변화 탭에서 제외한다. 동점은 공동 순위 1,1,3, playerId ASCII 오름차순이며 전체 필터 결과에서 순위를 부여한 뒤 페이지를 나눈다. 표시는 최종 UI에서만 소수 첫째 자리로 반올림하므로 표시값이 같아도 순위는 다를 수 있다. score=null·등록 미확인·표본 미달·중간 미만 신뢰도는 모든 순위에서 제외한다.
API는 동일 조건의 보드와 같은 원값·순위를 반환한다. `sort=score|change|decline`, 선택 `date`(KST)·`team`, 기존 role/window/season/competition/page/limit을 사용한다. API의 기본 기간은 역할별 권장값이므로 URL과 비교할 때 window를 명시한다.

R04 팀 범위 교정: `/api/v1/player-directory?team=...`의 games/ops/era/lastAppearance는 해당 팀 소속 로그를 먼저 제한한 최근 N 역할 출전이다. teams는 시즌 소속 이력, score/confidence는 전체 기세다. 2026 정규시즌·appeared만 지원한다. 랭킹 team은 전체 최근 표본의 소속 이력 필터이며 모든 게시 수치는 전체 표본 그대로다. 응답 형식과 모델 버전 변경은 없다.

### R06/R07/R09 응답 확장 및 실제 라우트 (ADR-032)

- 실제 `/compare`의 `players`는 쉼표 슬롯 최대 2개다(0/1명은 선택 안내). 3슬롯 이상·중복 쿼리·알 수 없는 필드는 오류 화면과 초기화 링크를 반환한다. 검증 오류에 ID를 2개 이하로 줄이라는 안내를 포함한다. `/api/v1/compare`는 기존 문서의 설계안이며 이번 변경에서 구현하지 않는다.
- `/api/v1/rankings`, `/api/v1/players/:id/momentum`의 data/excluded snapshot에 필수 `comparisonBasis` 추가: `{kind:'previous_eligible_publication',current:ComparisonPoint,previous:ComparisonPoint|null}`. deltaScore 및 previousSnapshotId는 기존 의미·값을 보존한다.
- `ComparisonPoint`: `{season,competition,role,window,modelVersion,snapshotId,asOf,sourceIds,inputRefs}`. role은 hitter/starter/reliever, competition은 regular/postseason이다. current/previous가 각각 자신의 원천을 유지한다. 이전 게시 대상이 없으면 previous=null이다.
- 타격/투구 상세 응답 및 `/compare` read는 동일 구조로 kind=`moving_appearance_window`를 제공한다. fixture release ID를 snapshotId로 사용하고 actual 창은 inputRefs로 식별한다. 이전 창은 최신 역할 출전 하나를 뺀 N출전이며 현재와 중첩한다. 자료가 존재해도 표본·결측으로 delta가 null일 수 있다. season 창은 comparisonBasis=null이다.
- `/api/v1/player-directory` 선수에 `registration:{status:'unknown',snapshotId:null,asOf:null,sourceId:null}` 추가. fixture에는 등록 스냅샷이 없기 때문이다. membership=appeared만 지원하고 current 등은 400이다. 기존 `/api/v1/players`의 등록 계약은 변경하지 않는다.
- 지원 범위: 2026 정규시즌 DEMO. player-directory는 다른 season/competition을 거부하며 compare/rankings는 다른 범위를 기록 없음·비교 제외로 안내한다. 데이터 계약을 실제 데이터 지원이나 공급 권리 승인으로 해석하지 않는다.
- 이행: DB/저장 JSON 마이그레이션 없음. 이전 게시 snapshot을 읽을 때도 서버가 추가 필드를 투영한다. strict 응답 소비자의 allowlist는 새 필드를 수용해야 한다. 수치·ID·modelVersion·DEMO/REAL 구분은 그대로 유지한다.

### 선수 탐색 표본 필터 (ADR-034)

`/api/v1/player-directory`의 선택 `sample` 쿼리: 빈 값(기본 전체), `complete`(games=window), `short`(0<games<window), `unscored`(score=null). 기존 팀·역할·시즌 출전 범위를 적용한 뒤 표본 필터, 고정 정렬, 페이지 분할 순으로 처리한다. score는 기존 전체 팀 기세이며 표본 충족은 기세 적격과 다르다. 미지원 값은 400. 기존 응답 및 저장 스키마는 그대로이므로 DB 마이그레이션은 없다.

## PR #1 통합 DEMO 릴리스 (additive)

공개 데이터 API 성공 응답은 `X-Pulse-Release`, `X-Pulse-Revision`, `X-Pulse-As-Of` 및 최종 JSON bytes의 SHA-256 ETag를 제공한다. `Cache-Control: no-store`는 유지하며 조건부 304는 제공하지 않는다. metadata의 선택적 `revision` 필드와 선수 탐색의 선택적 `teams: {teamId, name}[]` 필드를 추가한다. 기존 DTO와 pagination/error 형태는 유지한다.

`releaseId` 쿼리 또는 `X-Pulse-Release` 요청 헤더로 보존된 릴리스를 고정할 수 있다. 중복/형식 오류/헤더·쿼리 불일치는 400, 미연결/손상/알 수 없는 릴리스는 503이며 최신 내용으로 대체하지 않는다. 게시 후 기본 조회는 새 릴리스 전체를 제공하고, 고정한 과거 릴리스는 그대로 유지한다. 통합 게시는 2026 정규시즌의 완전한 자체 제작 DEMO 입력만 허용한다. 상세 내용은 [검증 수정 기록](PR1_VERIFICATION_FIX.md)을 따른다.

선수 탐색의 선택적 `playerCount`는 필터 전 릴리스 선수 수다. 필터 결과 `total`과 구분한다. 화면은 file 게시 시 고정 합성 데모의 150명/샘플 팀/결측 안내를 재사용하지 않는다.
