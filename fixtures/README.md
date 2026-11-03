# 완전 가상 fixture v2

실제 이름·성적·구단명·로고·사진·외부 데이터는 사용하지 않는다.
`players-v1.json`은 이전 API 식별자 테스트 자료로 보존하며 현재 앱은 사용하지 않는다.
현재 원본은 `src/demo/generator.ts`이고 생성 결과는 `pnpm db:seed`로 로컬 DB에 저장한다.

- seed: **20261103**, LCG32: `state = (1664525 * state + 1013904223) mod 2^32`.
  `Math.imul`과 unsigned shift를 사용한다. 외부 난수 라이브러리 없음.
- 실행 환경: Node **26.11.0**, 내장 `node:sqlite`, JS 정수 연산. 시계·네트워크·locale·Math.random 사용 없음.
- 팀 10개(샘플 A팀~J팀), 선수 150명(타자 100, 선발 30, 불펜 20).
- 2026-10-01~30의 30일 일정. 매 7번째 날 휴식, 10/12 한 경기 취소,
  10/13 같은 두 팀의 더블헤더, A-02의 10/06~11 부상, A-01의 10/16 B팀 이적,
  후보 타자 미출장, 첫 경기 삼진→일반 아웃 정정 증거(before/after/revision).
- 타석 이벤트는 솔로 홈런·일반 아웃·삼진으로 제한한다. 모든 안타는 홈런이며
  2루타/3루타/볼넷은 0이다. 현실 분포나 성적 예측을 위한 자료가 아니다.
- 양 팀 27아웃, 동점 허용의 가상 전시 규칙. 아웃은 정수 `outsRecorded`로 저장한다.
  투구 이닝을 소수로 저장하지 않는다. 정정 전 수치는 증거에만 남고 집계는 정정 후 한 번만 반영한다.
- 각 이벤트는 game ID, batter/pitcher ID를 가지며 게임 날짜·선수 소속·release의
  sourceId, season, competition, asOf로 원천 추적된다. `sampleSize`는 실제 생성된 출장 경기 수다.
- asOf/lastUpdatedAt은 고정 제작 시각이며 외부 기록 수집 성공 시각이 아니다.
- canonical JSON SHA-256: `b4edf2587144678531eb831cb2c853693a6d5a33c536dad6896a541a436a1627`.

`pnpm fixture:check`는 결정성·역할·예외 사례·이벤트/공수 합계·누적 합계·부상 공백·이적을 검증한다.
`pnpm demo:verify`는 실제 로컬 HTTP API에서 reset→503→seed→150명 목록/상세를 두 번 비교한다.

- 투수 상세 확장: 등판별 STARTER/RELIEVER를 명시한다. demo_0_10 선발, demo_0_14 불펜, demo_0_12 혼합 역할. 혼합 선수는 일부 구원 등판에 기존 구원 선수 대신 참여하며 이벤트/선수 합계를 함께 재생성한다. SQLite payload는 `pnpm db:seed`로 재생성한다. 구버전 payload는 canonical hash 검사로 거부한다. 투구수/구종/구속/개인 승패/HLD/SV는 미제공이며 0으로 생성하지 않는다.
