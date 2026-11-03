# DUGOUT PULSE

KBO 야구의 흐름을 한국어로 이해하는 서비스. 타자·선발·불펜의 최근 기세를 역할별로 설명하고, 기록의 출처와 표본 부족을 함께 보여준다.

현재는 **P1: DB 없는 Next.js 앱 뼈대** 단계다. 경로와 공통 UI를 구현했으며 데이터 수집기·점수 계산기·인증은 미구현이다. DEMO 전용이며 가짜 기록을 생성하지 않는다.

## 핵심 범위

- 타자·선발·불펜을 분리한 재현 가능한 기세 점수와 설명.
- 모든 수치에 출처(data source), 업데이트 시각(as-of), 시즌, 대회(정규시즌/포스트시즌), 표본 크기 추적.
- 표본 부족, 휴식·결장과 데이터 누락을 명시하고 이를 0점이나 실제 기록으로 위장하지 않기.
- 한국어·모바일·접근성 중심 UI와 로딩·오류·빈 화면·오프라인 대응.
- 승인된 입력 형식과 고정 fixture로 외부 연동 없이 end-to-end 개발.
- TypeScript strict, 입력 검증, 서버 권한 검증, 비밀 보호를 기본 적용.

**기본 모드: 데이터 공급 계약/승인 없음 → 데모 모드만 허용.** DEMO 수치는 실제 선수의 공식 기록으로 표시하지 않는다. 수치와 화면에 DEMO 여부를 전달하며, fixture에는 가상 식별자를 사용한다. 실제 데이터·로고·사진의 사용 권한은 확인되지 않았다. 허가 없는 KBO 자동 수집, 비공식 내부 API 분석, 접근 제한 우회를 구현하지 않는다.

## 현재 환경 진단 (2026-11-03, Asia/Seoul)

| 항목       | 확인 결과                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------ |
| OS         | macOS 15.7.4 (24G517), Darwin arm64                                                        |
| Node.js    | v26.11.0                                                                                   |
| npm / pnpm | 11.20.0 / 12.10.1                                                                          |
| Python     | 3.10.5                                                                                     |
| yarn / bun | PATH에서 발견되지 않음                                                                     |
| 초기 파일  | 프로젝트 폴더가 비어 있었음. 기존 코드·패키지·lockfile·스크립트 없음                       |
| Git        | 상위 홈 디렉터리 `/Users/seandhlee`가 루트, main, 커밋 없음. 프로젝트 내부 Git 저장소 없음 |
| 기존 에러  | 실행할 앱과 테스트가 없어 런타임 에러 재현 대상 없음                                       |

상위 Git 상태에는 개인 폴더들이 포함되어 있다. `git add .` 같은 광범위한 스테이징은 하지 않는다. 독립 저장소 구성은 P1 진입 조건으로 남긴다.

## 실행·개발·검사

Node.js 26.11.0 및 pnpm 12.10.1을 사용한다. 의존성은 정확한 버전과 `pnpm-lock.yaml`로 고정한다. npm/yarn lockfile은 사용하지 않는다.

```sh
pnpm install --frozen-lockfile
pnpm dev
# http://127.0.0.1:3000
```

환경 변수 없이 DEMO로 실행된다. 필요하면 `.env.example`을 `.env.local`로 복사한다. `DATA_MODE`는 빈 값 또는 `DEMO`만 허용하며 다른 값은 시작/빌드 시 Zod 검증으로 거부한다. DB·비밀·외부 계정은 필요 없다.

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm start
```

`typecheck`는 Next 경로 타입을 생성한 후 strict TypeScript 검사를 실행한다. `lint`는 Next Core Web Vitals/TypeScript와 jsx-a11y 권장 규칙을 실행한다. `test`는 DEMO 환경 검증, `test:e2e`는 별도 포트 3100의 dev 서버에서 전체 경로·404·기본 거부 관리자·모바일·키보드 진입·테마·toast·오프라인·axe 접근성을 검사한다. 브라우저 설치는 최초 1회 필요하다. Next의 동일 프로젝트 dev 서버 제한 때문에 E2E 실행 전 실행 중인 `pnpm dev`를 종료한다. `build`는 production 산출물을 만들며 `start`로 제공한다. 외부 폰트 요청은 없다.

### 화면 확인

`/`, `/players`, `/players/any-id`, `/rankings`, `/compare`, `/about`, `/admin`을 확인한다. 게시된 선수는 없어 모든 상세 ID는 404다. 관리자 안내 화면은 공개되지만 민감 데이터와 관리 기능은 서버에서 제공하지 않는다. 인증 구현이나 HTTP 403 응답을 완료했다는 의미는 아니다. 다크 모드 스위치, 하단 개발 상태 toast, 키보드 Tab의 본문 건너뛰기 링크를 확인한다. 모바일 360px/태블릿 768px/데스크톱 1280px와 200% 확대, 키보드 초점, VoiceOver 읽기 순서는 수동 검수 전략으로 유지한다. 자동 axe 통과가 전체 접근성 인증을 뜻하지 않는다.

### 구현 경계

공통 error boundary·global error·404·랭킹 경로 loading skeleton·empty state·오프라인 안내가 있다. 로딩/오류는 실제 Next 경계에서 사용하며 임의 장애를 만드는 공개 테스트 경로는 두지 않는다. 검색·필터·비교·기세·DB·인증·게시·수입 API는 다음 단계다. 수치가 없으므로 출처/as-of/시즌/대회/표본을 임의로 채우지 않는다. UI는 Radix Switch를 기반으로 소유한 컴포넌트를 사용하고 Tailwind v4와 CSS 디자인 토큰을 함께 쓴다.

초기 환경 표와 문서는 P0 당시 기록이다. 최신 설치·검증 기록은 [P1 검증](docs/P1_VALIDATION.md)을 따른다. 상위 홈 Git 저장소를 변경하거나 커밋·푸시하지 않는다.

## 문서

- [제품 요구사항과 기능 수락 기준](docs/PRD.md)
- [데이터 사전](docs/DATA_DICTIONARY.md)
- [공개 REST API 계약](docs/API_CONTRACT.md)
- [반응형 화면·상태 명세](docs/SCREEN_SPECS.md)
- [단일 저장소 아키텍처와 기술 선택](docs/ARCHITECTURE.md)

- [공통 실행 규칙](AGENTS.md)
- [P0~P5 로드맵과 수락 기준](docs/ROADMAP.md)
- [결정 기록과 ADR 틀](docs/DECISIONS.md)
- [미확인 가정](docs/ASSUMPTIONS.md)

- [데이터 권리 및 공급 승인 대장](docs/DATA_RIGHTS.md)
- [데이터 권리 출시 게이트](docs/RELEASE_GATES.md)

## 가상 fixture v2 · 로컬 DEMO DB

현재 선수 API와 목록/상세 화면은 **DEMO — 가상의 선수와 경기 기록**을 제공한다.
기존 P0/P1 설명은 초기 단계 기록이며, 현재 가상 데이터 구현은 이 절과
[fixture 명세](fixtures/README.md)를 따른다. 실제 기록·기세 모델·외부 연동은 제공하지 않는다.

추가 패키지·Docker·외부 계정 없이 Node 26.11.0 내장 SQLite를 사용한다.
`db:reset`은 `.demo/fixture.sqlite`의 DEMO release만 삭제한다. 기존 PostgreSQL
스키마의 reset/migration 명령이 아니다. DB 파일은 버전 관리하지 않는다.

```sh
pnpm db:reset
pnpm db:seed
pnpm dev
# 다른 터미널: 개발 서버가 3000번 포트에서 실행 중일 때
DEMO_BASE_URL=http://127.0.0.1:3000 pnpm demo:verify
pnpm fixture:check
pnpm test
```

`demo:verify`는 로컬 DEMO DB를 두 번 비우고 재생성하므로 동시 seed/reset과 실행하지 않는다.
동일 seed의 전체 선수 150명 목록과 상세·기본 기록을 비교한다. reset 후 API는
`503 DATA_UNAVAILABLE`, seed 후 `200`, `meta.demo: true`, `sourceMode: DEMO`다.
`/players`에서 첫 20명과 상세 링크, `/players/demo_0_00`에서 기본 기록·표본·출처를 확인한다.
전체 목록은 `/api/v1/players` 응답의 `pagination.nextCursor`로 다음 페이지를 조회한다.
`/api/v1/players/demo_0_00`은 이적 선수를 조회하는 예다.

브라우저 검증은 `pnpm test:e2e`가 seed 후 별도 3100번 서버를 시작한다. 기존 dev 서버를
사용하려면 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e`를 실행한다.
Prisma 런타임은 현재 의존성에 없어 전체 `pnpm typecheck`가 기존 `prisma/config`
참조에서 실패한다. 패키지를 설치하지 않았으며 PostgreSQL seed/검증 완료로 해석하지 않는다.

## 전체 검증

`TEST_DATABASE_URL=<일회용 PostgreSQL URL> pnpm verify` — lint, typecheck, 핵심 커버리지, SQL migration, build, public/admin E2E를 순서대로 실행합니다. 준비 요건과 테스트 범위·실측 결과는 [테스트 안내](docs/TESTING.md)를 참고하세요.

## 외부 DEMO 배포 준비 (2026-11-03)

Render Docker Web Service를 선택했고 Neon PostgreSQL은 별도 준비 대상으로 문서화했다.
현재 공개 앱은 PostgreSQL 연결 없이 canonical SQLite 합성 fixture만 읽는다.
배포된 URL은 **없음**. 기본 canonical 주소는 `https://dugout-pulse.invalid` placeholder다.
유료 인프라·DNS·외부 서비스 생성·패키지 설치·Git 커밋/푸시는 실행하지 않았다.

설치, 환경별 비밀 설정, 수동 배포, SQL migration deploy, readonly, 백업/복원,
rollback, 장애·권리 철회 대응 명령은 [DEPLOY_RUNBOOK](docs/DEPLOY_RUNBOOK.md)을 따른다.
공식 공급자 지원 문서·비용 발생 지점도 해당 문서에 기록했다.
`pnpm db:migrate`의 Prisma CLI는 미설치이며, 새 `db:deploy:sql`과 혼용하지 않는다.

```sh
pnpm db:seed
APP_ENV=staging DATA_MODE=DEMO pnpm build
APP_ENV=staging DATA_MODE=DEMO PUBLICATION_STATE=demo pnpm start --port 3200
# 다른 터미널
SMOKE_BASE_URL=http://127.0.0.1:3200 pnpm deploy:smoke
node scripts/demo-backup-rehearsal.mjs
# 서버를 자동 실행·종료하며 정상/점검 모드 확인 (3200/3201 포트가 비어 있어야 함)
node scripts/deploy-local-smoke.mjs
```

- 환경: `.env.example`의 APP_ENV를 demo/staging/production으로 분리한다. 모두 DATA_MODE=DEMO, 관리자 비밀과 DATABASE_URL은 미설정. 배포 환경 관리자 요청은 서버에서 403으로 거부한다.
- 운영: `/api/health`는 생존, `/api/ready`는 canonical DEMO·schema·import 상태를 검증한다. 스키마 불일치/변조는 503, `PUBLICATION_STATE=maintenance`는 페이지/데이터 게시를 중단한다.
- 고지: footer의 `/legal`, `/privacy`, `/data-terms`, `/about`에서 권리·개인정보·면책·출처 확인. 운영자/문의는 미정으로 표시하며 공개 출시 전 확정한다.
- 검증: local production build, 정상/maintenance HTTP smoke, SQLite 백업/복원 리허설 통과. Docker와 PostgreSQL client가 없어 이미지 빌드·Neon migration/복원은 미실행. 실제 외부 배포 성공을 의미하지 않는다.

최종 검증 명령: `pnpm build`, `node scripts/deploy-local-smoke.mjs`, `node scripts/demo-backup-rehearsal.mjs`, `pnpm lint`, `pnpm typecheck` 통과. `pnpm test`는 24개 파일·232개 테스트 통과/1개 건너뜀. 이후 추가한 배포 보호 및 스키마 회귀 검사는 `pnpm exec vitest run tests/unit/deployment.test.ts tests/unit/performance-cache.test.ts`의 6개 통과로 확인했다. 로컬 포트 접근은 샌드박스에서 EPERM으로 차단되어 허용된 실행 환경에서 smoke를 재실행했다.
