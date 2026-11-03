# P1 앱 뼈대 검증

기준일: 2026-11-03 Asia/Seoul. DB 없는 DEMO 개발 앱이다.

## 수행 작업 및 파일

- 기존 AGENTS 및 설계 문서를 보존했다. README의 현재 단계·실행법을 갱신하고 DECISIONS에 ADR-010, ASSUMPTIONS에 P1 경계를 추가했다.
- package.json, pnpm-lock.yaml, pnpm-workspace.yaml: pnpm 12.10.1, exact 의존성, 프로젝트 내부 storeDir. 자동 생성된 minimumReleaseAgeExclude는 설치한 정확한 버전만 열거한다.
- tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, .prettierrc.json, .prettierignore, .editorconfig, .gitignore, .env.example: strict·alias·검사·환경 구성.
- src/app: 홈·선수 탐색·선수 상세·랭킹·비교·소개·관리자, 404·오류·global 오류·랭킹 loading, 글로벌 반응형 스타일.
- src/components: 접근 가능한 nav·테마 Switch·toast·오프라인 안내·empty·skeleton. src/config/env.ts: 서버 시작/빌드 DEMO 전용 Zod 검증.
- tests/unit/env.test.ts, tests/e2e/shell.spec.ts, vitest.config.mts, playwright.config.ts: 실제 실행 검사.

## 명령과 결과

- `pnpm install`: 성공. 초기 TypeScript 7은 ESLint parser peer 범위와 충돌해 registry에서 확인한 6.0.3으로 조정했다.
- `pnpm install --frozen-lockfile --offline`: 성공. lockfile 변경 없이 재설치 확인.
- `pnpm peers check`: 성공, peer 문제 없음.
- `pnpm typecheck`: 성공. Next route typegen 후 tsc strict.
- `pnpm lint`: 성공, 경고 0. Next에 이미 등록된 jsx-a11y plugin을 중복 등록하던 첫 설정 오류는 recommended rules만 추가하여 수정했다.
- `pnpm test`: 성공, 환경 기본값/실제 모드 거부 2개.
- `pnpm format:check`: 성공.
- `pnpm test:e2e`: 성공, Chromium 2개. 공개 6경로의 heading/axe, 선수 상세/알 수 없는 경로의 HTTP 404, 360px 가로 넘침 없음, skip link 초점, 다크 테마/유지, 다크 axe, toast, offline.
- `pnpm build`: Webpack production 빌드 성공. 모든 필수 경로가 산출됨.
- `pnpm start --port 3200`: Ready 및 실제 HTTP 검사 성공. 공개 6경로 200, `/players/any-id`와 `/missing`은 404.
- `pnpm dev`: 127.0.0.1:3000 Ready 및 실제 Chromium 접속 성공. 360/768/1280px에서 scrollWidth가 viewport와 같음을 확인하고 모바일/데스크톱 스크린샷을 시각 확인했다.

실패 이력도 구분한다. 최초 sandbox DNS/포트 제한은 설치 및 dev/E2E 권한 확장으로 실행했다. Turbopack은 내부 PostCSS 통신 포트 EPERM으로 실패했고 권한 확장 실행에서도 동일하여 dev/build를 검증된 Webpack으로 명시했다. 첫 axe 실패(배지 대비 4.39 및 DEMO landmark 누락)는 색상/region 수정 후 통과했다. 루트 loading은 상세 notFound 응답을 스트리밍 200으로 만들어 랭킹 로딩 경계로 이동 후 HTTP 404를 확인했다. 별도 dev가 실행 중이면 E2E dev 중복 제한이 있으므로 먼저 종료한다.

## 화면 확인 방법

`pnpm dev` 후 http://127.0.0.1:3000 에서 주 메뉴, 다크 모드, 하단 개발 상태 확인 버튼을 사용한다. `/players/any-id`와 `/missing`은 404, `/admin`은 기능 없는 제한 안내다. `pnpm build && pnpm start`로 production 화면을 확인한다.

## 알려진 제한과 다음 단계

- DB·fixture 조회·검색·비교·점수·출처 메타 API·인증·관리자 게시/수입은 미구현. 인증된 관리자 기능을 제공하지 않는다. 관리자 안내 페이지 자체는 HTTP 200이다.
- 출처·as-of·시즌·대회·표본은 미게시이며 임의 수치를 만들지 않았다. 외부 야구 데이터·폰트·사진·로고 수집 없음.
- 오류/랭킹 loading 경계는 구현했으나 강제 장애·지연의 브라우저 검사는 미실행. 키보드 전체 흐름·VoiceOver·200% 확대의 수동 검수와 다른 OS/브라우저는 후속이다. axe 통과가 모든 접근성을 증명하지 않는다.
- ESLint 9.39.1에는 deprecated 안내가 있다. peer 충돌은 없으며 이번 lint는 통과한다. Playwright 실행의 색상 환경 변수 및 Next dev Fast Refresh 로그는 비실패 경고다.
- 홈 Git 경계·설정·파일을 탐색/스테이징/커밋/푸시하지 않았다. 독립 Git 경계 구성은 별도 후속으로 남긴다.
- 다음 P2는 기존 v1 데이터 계약의 Zod/가상 fixture 구현과 출처 추적이다. 영속 게시와 인증 도입 시 별도 스키마·마이그레이션·권한 통합 검증이 필요하다.

커밋 제안(실제 커밋 안 함): `feat: scaffold DEMO Next.js app with accessible shell and verified tooling`
