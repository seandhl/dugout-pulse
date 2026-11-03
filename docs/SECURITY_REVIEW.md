# 보안 검토

2026-11-03 (Asia/Seoul). 대상: 현재 프로젝트 파일과 설치된 패키지. OWASP 접근 제어·입력·구성·의존성·자원 통제 관점의 코드 검토와 회귀 검사이며 외부 침투 테스트 인증이 아니다. **공개 출시 BLOCKED**. 고위험 가능성이 남은 의존성/배포 검증을 완료하기 전에는 DEMO도 인터넷에 공개하지 않는다.

## 발견 → 위험 → 대응 → 재검증

| 발견 | 위험 | 대응 | 재검증 |
| --- | --- | --- | --- |
| 공개 `/api/v1/*` 요청 제한 없음 | 중간: 계산·파일 읽기·요청 로그 쓰기 비용 및 서비스 거부 | proxy에서 전체 공개 API에 프로세스당 300회/분 예산, 429·Retry-After·no-store. 쿼리 4096자 제한. 전달된 IP 헤더를 신뢰하지 않음 | 새 회귀 테스트에서 301번째 요청 및 위조 x-forwarded-for 요청 거부 |
| 보안 헤더 없음 | 중간: 클릭재킹·MIME 혼동 및 브라우저 방어 부재 | 전 경로 nosniff, DENY, Referrer/Permissions Policy, CSP. production만 HSTS 및 eval 금지 | 정책 단위 검사 통과. 실제 HTTP 확인은 환경 EPERM으로 미완료 |
| 서명을 JS 문자열 길이로 비교 | 낮음: 동일 문자 수의 유니코드 서명에서 timingSafeEqual 예외 | 바이트 길이 검사, 서명 hex 형식과 정확한 두 세그먼트 강제 | 유니코드·추가 세그먼트 회귀 검사 통과 |
| published API 중복 쿼리를 마지막 값으로 해석 | 낮음: 프록시/애플리케이션 파라미터 해석 불일치 | 공통 queryInput 사용, BAD_INPUT을 400으로 응답 | 공통 중복 쿼리 및 published 직접 호출 400 회귀 검사 통과 |
| 의존성 전체 감사 미완료 | **높음 가능성 미해소: 공개 출시 차단** | pnpm audit 실행했으나 registry DNS 실패. 설치/업데이트 금지 경계에 따라 패키지·lockfile 미변경 | 감사 성공 및 critical/high 해결 또는 영향 없음 증빙 전 차단 |
| 배포 ACL·공유 요청 제한·프로덕션 인증 설정 미검증 | **높음 가능성 미해소: 공개 출시 차단** | 아래 배포 체크리스트 강제. 단일 프로세스 제한은 ingress 방어 대체 불가 | 실제 운영 환경 미제공으로 미실행 |

CSP는 현재 Next inline bootstrap과 UI inline style 호환을 위해 `unsafe-inline`을 허용한다. 완전한 XSS 차단 정책이 아니며 nonce/hash 적용은 별도 동적 렌더링·캐시·브라우저 검증이 필요하다. 개발 모드만 eval 및 WebSocket 허용. 프로덕션 HTTPS 종단에서 헤더를 유지해야 한다.

## 공격 표면별 확인

- 인증/IDOR: 관리자 페이지 proxy 검사 외에 upload/status/templates/publish/rollback/operations의 서버 핸들러가 assertAdmin을 호출한다. 브라우저 UI 숨김에 의존하지 않는다. 단일 ADMIN 역할만 있으며 다중 테넌트 권한 체계는 없다. batch ID를 알아도 인증이 필요하다. 공개 선수 ID 조회는 의도된 공개 DEMO DTO이다.
- CSRF: 관리자 변경 요청은 정확한 ADMIN_ORIGIN을 요구한다. cross-site 요청 거부, HttpOnly·Secure·SameSite=Strict·__Host 쿠키, 15분 만료. 로그인/로그아웃도 origin 검사. 비밀이 없으면 기본 거부한다. Host 검사 자체는 VPN/ACL을 보장하지 않으므로 네트워크 접근 제어가 별도로 필요하다.
- 파일: 인증 후 스트림을 읽으며 5 MiB, 50,000행, CSV 열/셀 제한, UTF-8·확장자·MIME 검사, 경로 구분자 거부. 현재 업로드는 제공 fixture와 체크섬이 일치해야 한다. 업로드 내용을 실행하거나 public 경로에 저장하지 않는다. 파일 없는 파서 테스트만으로 임의 외부 데이터 허용을 승인하지 않는다.
- SQL injection: 실행 경로에 동적 raw SQL 없음. Zod strict 스키마와 sort enum, filter enum, ID 형식 검증. players 최대 20개, directory 고정 20개. DB projector는 미연동 경계이므로 실제 DB 권한·파라미터 쿼리는 연동 시 재검사한다.
- XSS: src 코드에서 dangerouslySetInnerHTML/eval/new Function 사용 경로 없음. React 텍스트 출력과 일반화된 오류 UI 사용. 입력 문자열을 HTML로 해석하는 기능 추가 시 재검토한다. CSP만으로 안전하다고 판단하지 않는다.
- CSV injection: validateRows가 공백/제어문자 다음 =,+,-,@ 시작 셀을 거부한다. 템플릿은 고정 fixture이며 사용자 입력을 CSV 수식으로 내보내는 기능은 없다.
- SSRF: src 서버/API에 사용자 지정 URL fetch 경로 없음. 외부 공급자 수집은 미구현. 향후 공급자 구현 시 HTTPS 호스트 허용 목록, 리다이렉트 재검증, 사설/메타데이터 주소 거부와 egress 제한이 필요하다.
- 오류: respond/failure는 알 수 없는 예외에 고정 메시지와 500 반환. UI에 Error.stack/message 출력 없음. telemetry는 요청/헤더/body/actor를 직렬화하지 않는 허용 목록. 새 회귀 검사에서 내부 오류 문자열 미노출 확인.
- 캐시/비용: 공개 데이터 응답은 no-store 중심, directory 계산 캐시는 최대 4개 키. 외부 유료 API 호출 없음. 요청 예산은 전체 사용자 공유라 공격자가 정상 사용자까지 제한할 수 있다. 재시작/다중 인스턴스에서는 카운터가 공유되지 않는다. ingress 요청·동시 연결·바디 시간 제한, 로그 회전/디스크 quota, 관리자 업로드 보관 한도를 출시 전에 설정한다.
- CORS: Access-Control-Allow-Origin/credentials 허용을 추가하지 않는다. 공개 GET DEMO는 인증 없이 제공하지만 CORS는 서버·CLI 접근을 막지 않는다. 관리자 origin은 고정·변경 요청 동일 출처만 허용하며 wildcard CORS 금지.
- 데이터 권리: DATA_MODE=DEMO만 허용. fixture 체크섬과 게시 권리 gate를 유지한다. 라이선스 미승인/만료/철회는 거부 테스트 존재. 실제 KBO 수집·비공식 API·로고/사진을 추가하지 않았다.

## 비밀과 의존성

`.gitignore`는 `.env*`를 제외하고 값 없는 `.env.example`만 허용하며 node_modules, .next, .demo도 제외한다. 프로젝트 파일 패턴 검사에서 private key, AWS access key ID, GitHub token, OpenAI project key 패턴 일치 0건. 이것은 모든 형식의 비밀 부재를 증명하지 않는다. 테스트의 고정 가짜 secret은 운영에 사용 금지.

Git 루트는 `/Users/seandhlee`, 현재 main에 커밋 없음. 프로젝트 범위 git status는 미추적 상태이고 `git log -- .`는 no commits로 실패했다. 홈 파일/다른 브랜치·객체·원격 이력은 작업 경계상 탐색하지 않았다. 독립 저장소와 실제 전체 이력이 준비되면 비밀 이력 검사를 수행하고 발견된 키는 삭제만 하지 말고 폐기·재발급한다. 커밋/푸시 미수행.

설치 선언: Next 16.4.4, React/React DOM 19.3.1, Zod 4.6.7. [Next 공식 2026-10-14 공지](https://nextjs.org/blog/nextjs-security-update-october-14-2026)는 16.4.1을 당시 수정 버전으로 안내한다. 현재 선언은 그 버전 이후지만 전체 전이 의존성 안전을 증명하지 않는다. `pnpm audit --json`은 ERR_PNPM_AUDIT_BAD_RESPONSE / registry.npmjs.org DNS 오류로 exit 1. 취약 패키지가 없다고 판정하거나 검증되지 않은 대체 패키지를 추가하지 않았다.

## 관리자 부트스트랩 및 환경 분리

1. 테스트/개발/운영별 별도 secret 저장소를 사용한다. 운영에 테스트 env, 고정 actor/secret, `INGEST_E2E=1`, 개발 서버를 배포하지 않는다. ADMIN 설정을 비워 두면 접근을 거부한다.
2. 운영 담당자가 암호학적 난수로 32~256 printable ASCII 토큰과 최소 64자 세션 서명 secret을 생성한다. 원문 토큰은 비밀 전달 수단으로만 전달하고 SHA-256만 INGEST_ADMIN_TOKEN_SHA256에 설정한다. ADMIN_ACTOR_ID는 지정 운영자 ID, ADMIN_ORIGIN은 경로 없는 정확한 HTTPS origin으로 설정한다. NEXT_PUBLIC_에 비밀을 넣지 않는다.
3. 관리자 origin/경로를 VPN 또는 ingress ACL 뒤에 두고 TLS를 설정한다. 로그인은 토큰 검증 후 15분 쿠키 발급. 기본 계정/공개 가입/백도어 없음. 현재 단일 운영자 모델로 MFA·개별 세션 폐기는 없다. secret 교체와 프로세스 재시작으로 전체 세션 폐기, 토큰 해시 교체로 로그인 토큰 폐기.
4. 격리된 운영 유사 환경에서 무인증·위조·만료 쿠키, 잘못된 Origin, 직접 API 호출, 로그아웃, 429, TLS/헤더를 확인한다. 운영 토큰을 CLI 이력/문서/스크린샷에 남기지 않는다.
5. 공유 rate limit/네트워크 ACL, 로그·업로드 quota/회전, 감사 성공, build/typecheck/test 성공과 운영자 검토 증빙이 모두 있어야 공개 출시 게이트 재검토 가능. 문서 작성은 승인 아님.

## 실행 기록

- `pnpm lint`: exit 0 (최종 수정 후 재실행 결과는 아래 추가 기록).
- `pnpm test`: 22 files / 223 tests 중 222 통과, momentum-snapshots 1개 5000ms timeout으로 exit 1. 해당 파일 단독 재실행도 5 통과·1 timeout. 테스트 제한을 바꿔 성공으로 처리하지 않음.
- `pnpm exec vitest run tests/unit/security-review.test.ts tests/unit/admin-security.test.ts tests/unit/api.test.ts tests/unit/ingest.test.ts tests/unit/provider.test.ts tests/unit/env.test.ts`: 6 files / 48 tests 통과, exit 0.
- `pnpm typecheck`: next typegen 성공 후 prisma.config.ts의 `prisma/config` 모듈 누락으로 exit 2. package.json에 Prisma 의존성 선언이 없고 이번 단계 설치 금지로 미수정.
- `pnpm build`: webpack compile 성공 후 같은 Prisma 모듈 누락으로 exit 1. 프로덕션 빌드 성공으로 보고하지 않음.
- `pnpm audit --json`: 위 DNS 실패로 exit 1. 전체 의존성 감사 미완료.
- 브라우저 자동화/프로덕션 배포 검증: 미실행. 운영 환경 없음 및 빌드 차단. 기존 페이지는 `pnpm dev` 후 `/`, `/players`, `/admin/login`에서 확인. 관리자 미설정 시 접근 거부가 정상. DevTools Network에서 CSP/nosniff/frame 정책과 실패 응답의 내부 스택 미노출을 확인한다.

변경 파일: next.config.ts, src/proxy.ts, src/server/http/security.ts, src/server/ingest/admin.ts, src/app/api/v1/published/route.ts, tests/unit/security-review.test.ts, docs/SECURITY_REVIEW.md, docs/RELEASE_GATES.md. 스키마/DB 계약 변경 없음. 다음 단계는 설치 승인 범위 확정 후 Prisma 빌드 문제와 전체 의존성 감사 해결, 실패 테스트 원인 확인, 운영 경계 검증이다.

최종 추가 기록: 변경 후 `pnpm lint` exit 0. published 직접 중복 쿼리 검사 포함 보안 관련 48개 테스트 통과. `pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3087`은 listen EPERM으로 exit 1, 실제 HTTP 헤더/화면 확인 미완료. 위 화면 확인 절차는 실행 결과가 아닌 재검증 방법이다.
