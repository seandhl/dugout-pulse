# DUGOUT PULSE 공통 실행 규칙

이 파일은 이 프로젝트와 모든 하위 경로의 작업에 적용한다.

1. 현재 저장소 파일, 패키지 버전, 스크립트, 에러부터 확인한다. 존재하지 않는 코드·함수·API를 추측하지 않는다. 기존 코드를 지우거나 덮어쓰지 않고 변경 전 상태를 확인한다.
2. 계획으로 끝내지 않는다. 승인된 단계에서 수정 가능한 파일을 실제 생성·수정하고 실행 가능한 검증을 수행한다.
3. 이전 구조와 계약을 존중한다. 필요한 계약·스키마 변경에는 마이그레이션과 테스트를 동반한다.
4. TypeScript strict, 입력 검증, 서버 권한 검증, 에러 처리, 로딩·빈 화면·오프라인 대응을 기본으로 한다.
5. 임의 생성 수치를 실제 선수 공식 기록처럼 표시하지 않는다. 데모 데이터에는 DEMO 배지를 표시한다.
6. 허가 없는 KBO 자동 크롤링, 비공식 내부 API 리버스 엔지니어링, 접근 제한 우회, 로고·사진 무단 사용을 구현하지 않는다.
7. 모든 수치의 출처(data source), 업데이트 시각(as-of), 대회(정규시즌/포스트시즌), 시즌, 표본 크기를 추적한다. 가공 수치에도 원천 추적성을 유지한다.
8. 타자·선발·불펜 기세 모델을 분리한다. 표본 부족과 휴식·결장을 숨기지 않는다.
9. 외부 데이터가 없어도 승인된 입력 형식과 재현 가능한 fixture로 end-to-end 개발을 가능하게 한다.
10. 각 단계 종료 시 한국어로 a) 수행 작업 b) 변경 파일 c) 테스트 명령·결과 d) 화면 확인 방법 e) 알려진 제한 f) 다음 단계 준비를 보고한다.
11. 실패한 테스트를 성공으로 보고하지 않는다. 불가능하거나 미구현인 연동은 mock/demo 상태로 명확히 구분한다.
12. 유지 보수 가능한 설계와 명확한 경계를 우선한다. 불필요한 추상화·새 서비스·구독형 외부 인프라를 도입하지 않는다.
13. 해당 단계의 수락 기준을 충족할 때만 다음 단계로 진행한다. 기능을 조용히 생략하지 않는다.
14. 비밀 관련 파일은 값이 없는 `.env.example`만 버전 관리한다. 실제 비밀·개인정보·관리자 자격증명을 커밋하지 않는다.
15. 일관된 코드 스타일, 접근성, 모바일 성능과 한국어 인터페이스를 지킨다.

## 기본 결정과 작업 경계

- 데이터 공급 계약/승인 없음 → 데모 모드만 허용. 라이선스나 외부 계정 권한을 추정하지 않는다.
- 이번 P0에서는 외부 데이터를 수집하지 않으며 패키지를 설치하지 않는다.
- 현재 Git 루트는 홈 디렉터리다. 홈 파일을 탐색·스테이징·수정하지 않는다. 독립 저장소 구성 전 커밋·푸시를 수행하지 않는다.
- 합리적인 기본값은 ADR에 제안/채택 상태를 구분해 남기고, 미확인 사실은 ASSUMPTIONS에 기록한다.
- 실행하지 못한 검사는 미실행 사유를 보고한다. 문서 검증을 앱 테스트 통과로 표현하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
