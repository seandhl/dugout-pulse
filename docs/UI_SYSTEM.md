# 재사용 UI 시스템
- 미리보기: /design-preview (현재 localhost:3000). 실행: pnpm dev.
- AppShell / TopNav / MobileBottomNav: src/components/shell.tsx. Shell alias는 기존 사용처 호환용이다.
- 나머지 컴포넌트: src/components/ui/index.tsx. Provenance를 지표/차트에 전달한다. SampleReliability의 minimum=null은 모델 미정이다.
- 색상·간격·반응형·모션: src/app/globals.css. 미리보기의 기반 규칙 탭에서 확인한다.
- 테스트: pnpm typecheck, pnpm lint, pnpm test (2개) 통과. pnpm build 통과.
- pnpm test:e2e는 sandbox 포트 EPERM, 권한 확장 후에는 기존 개발 서버와 충돌하여 실패했다. 기존 localhost:3000을 재사용하는 playwright.preview.config.ts로 pnpm exec playwright test --config playwright.preview.config.ts --workers=1 실행: 3개 통과.
- 검사 범위: 320/1280px 수평 넘침, 라이트/다크 axe 대비 포함, 건너뛰기 포커스, 탭 방향키, 콤보박스 검색/선택/Escape 복귀, 빈 결과, reduced-motion. 기존 공개 경로/404/테마/오프라인 회귀 포함.
- 초기 병렬 실행 중 build/dev 산출물 충돌로 일시적 탭·404 실패가 있었다. 빌드 종료 후 순차 재실행에서 팝오버 접근성 이름 누락을 발견·수정했고 전체 재실행 통과했다.
- 데스크톱 전체 캡처로 레이아웃 확인. 수동 스크린리더·실기기 테스트는 미실행.
- 제한: 기세 게이지는 산정 대기만 제공한다. 실제 모델·데이터 연동·게시·인증은 이번 범위 밖이다. 외부 패키지/폰트/사진/로고를 추가하지 않았다.
- 다음 단계: 모델 ADR 및 승인된 fixture 입력 계약 구현 후 UI에 연결한다. 실제 데이터 도입 전 권리 검증이 필요하다.

## B01 현행 확장

프리미엄 스포츠 데이터 대시보드의 토큰·적용 경로·접근성·시각 회귀 기준은 [B01_VISUAL_SYSTEM.md](B01_VISUAL_SYSTEM.md)를 따른다. 위 초기 구축 기록의 모델 pending/테스트 개수는 당시 이력이며 현재 검증 결과를 의미하지 않는다.
