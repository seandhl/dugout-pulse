# 투수 상세 검증 · 2026-11-03

- 수행: 타자 공통 메뉴/프로필/footer 재사용, 투수 독립 read/API/통계, 선발 3/5/10·불펜 5/10/20·역할 시즌 선택, 시즌 전체와 역할 시즌 구분, 등판 로그, ERA 표본 안내, 역할별 모델/baseline 근거.
- 변경: src/stats/pitching.ts, src/demo/generator.ts, pitcher-detail read/component/API, detail-shared 및 기존 player-detail/component/page, 단위/E2E 테스트, fixture digest와 관련 문서.
- `pnpm test`: 16개 파일, 197개 테스트 통과. 원시 line 대비 역할별 합산, 혼합 역할 분할 합계, 17 outs=5.2 IP 및 17+1+0 outs=6.0 IP, ERA/WHIP/K/9/BB/9/K-BB% 검증.
- `pnpm lint`: 통과.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm exec playwright test tests/e2e/pitcher-detail.spec.ts tests/e2e/player-detail.spec.ts`: 6개 통과. 기존 로컬 서버 사용. 3개 투수 fixture의 모든 역할별 기간에서 합계/IP/API-화면 일치, 혼합 역할 전환, 모바일 넘침/axe, 미제공 투구수 숨김, 잘못된 기간 400, 오류 재시도 및 기존 타자 회귀 검증.
- E2E 최초 시도는 로컬 포트 sandbox 차단, 다음은 기존 3100 서버 충돌로 실행 불가. 기존 서버 지정 후 발견한 aside 접근성 문제와 alert 테스트 선택자를 수정하고 재실행하여 6개 통과했다.
- `pnpm typecheck`: 실패. 기존 prisma.config.ts의 `prisma/config` 미설치(TS2307) 한 건. 패키지 설치 금지에 따라 설치하지 않았다. 전체 타입 검사나 빌드 통과를 주장하지 않는다.
- 화면: `pnpm db:seed`, `pnpm dev --port 3100` 후 `/players/demo_0_10?role=starter&window=3`, `/players/demo_0_14?role=reliever&window=20`, `/players/demo_0_12?role=starter&window=5`. 혼합은 기록 역할 선택으로 불펜 전환. test-results/demo_0_12-pitching-mobile.png 시각 확인.
- 제한: DEMO만. 투구수/구종/구속 미제공 영역 숨김. HLD/SV와 개인 승패는 N/A/미제공. baseline/표본 미달 또는 시즌 선택 시 점수 보류. 현재 컨디션·로스터 미확인. 실제 데이터 연동과 DB 스키마 변경 없음.
- 다음 단계 준비: 승인된 source의 역할·투구수·결과 필드 매핑 및 권한 확인 후 adapter 확장. Prisma 의존성 복구 허용 후 전체 typecheck/build 확인.
