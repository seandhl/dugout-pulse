# 최근 출전 기세 UI 검증 · 2026-11-04

기준: `6f72cd03620f4ca8278b8c0673437d30f9deac8c`, 새 브랜치 `codex/momentum-context-ux`. 시작 시 기존 미커밋 수정이 다수 있었으며 보존했다. 이 문서의 변경 목록은 이번 작업에 한한다. 외부 수집·설치·DB seed/삭제·커밋·푸시·배포 없음.

## 변경과 설계

- `home-dashboard.tsx`: 점수순 TOP5 제목 수정, 선택 창 대비 출전 표본, 미제공 변화량 N/A, 시즌·대회·기준일 및 점수 해석.
- `player-detail.tsx`, `pitcher-detail.tsx`, `detail-shared.tsx`: 선택 창·실제 표본·asOf를 통계 그래프와 연결하고 점수/역할 비교 한계 및 미지원 투수 창 명시.
- `game-analysis.tsx`, `src/ui/game-timeline.ts`: 날짜/DH/ID 순서, 달력 공백 표기·선 끊기, 출처/asOf/산식 표시, 대체 표 공백 열, 출전당 점 간격 확보. 기존 엔진의 누적·최대 5출전 이동 값 유지.
- `rankings/page.tsx`: 점수 해석 및 N/A 변화량, 키보드 표 스크롤.
- `globals.css`: 테마 회색 N/A와 긴 문구 줄바꿈.
- `tests/unit/game-timeline.test.ts`, E2E `home`, `game-analysis`, `momentum-context`: 순서·공백·fixture·점수 안내 회귀.
- `DECISIONS.md` ADR-034 및 `ASSUMPTIONS.md`: API 미제공·미지원과 공백 해석 경계 기록. 공개 API/modelVersion/DB 변경 없음.

## 검증

- `pnpm test`: 30파일, 270 passed / 1 skipped (선택적 성능 benchmark).
- E2E 명령: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3198 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/player-detail.spec.ts tests/e2e/pitcher-detail.spec.ts tests/e2e/game-analysis.spec.ts tests/e2e/rankings.spec.ts tests/e2e/momentum-context.spec.ts --workers=1`.
- 최초 sandbox 실행은 Chromium/localhost 권한 실패. 제한 밖 실행은 16통과/3실패: 새 N/A 색 대비 4.43:1. 기존 `--muted` 토큰 적용 후 재실행 19/19 통과. axe·320/390px 넘침·1440px 홈·키보드·로딩/재시도 포함.
- 최종 production 차트 회귀 `... playwright test tests/e2e/game-analysis.spec.ts --workers=1`: 4/4 통과. 정규시즌 문구 검사 추가 후 실행했다.
- `pnpm build`: 최종 수정 후 통과.
- `pnpm typecheck`: 통과. `pnpm lint`: 최초 1오류/1경고 수정 후 통과.
- 모바일 홈·320px 긴 상대명 차트 PNG 직접 확인. 대회명 표시 오역을 발견해 원래 한국어 값도 보존하도록 수정했다.

## 화면과 제한

`pnpm dev --port 3198` 후 `/`, `/players/demo_0_00?window=20`, `/players/demo_0_10?role=starter&window=5`, `/rankings`. 3/5/10/20 창 전환, DEMO·데이터 기준일·표본·신뢰도, 그래프 아래 대체 표를 확인한다. 투수 상세는 기존 API 지원 창만 선택 가능하다.

홈 변화량과 PA/BF는 현재 DTO에 없어 계산해 만들지 않는다. 신뢰도는 표본 충족 수준이며 미래 예측 정확도가 아니다. 팀 일정·부상·결장 사유 미확인. 실제 기세 점수 시계열이 아니라 통계 누적·이동 추이다. 외부 REAL 데이터 검증은 범위 밖이다.

되돌리기는 기존 미커밋 수정이 있으므로 전체 `git restore`/reset을 사용하지 않는다. 위 파일의 이번 문구·타임라인·CSS·E2E 추가 hunk만 역적용하고 신규 timeline/helper 테스트 및 이 보고서를 제거한다. ADR-034와 가정 추가 절도 함께 되돌린다. 다음 단계는 반복·저사양 성능 측정 및 필요 시 홈 변화량의 명시적 계약 확장·회귀 검증이며 REAL 연동은 데이터 권리 승인 후에만 가능하다.


## Production 성능 점검

`scripts/momentum-ux-performance.mjs` 추가. `PERFORMANCE_BASE_URL=http://127.0.0.1:3198 node scripts/momentum-ux-performance.mjs` 실행 결과는 `reports/momentum-ux-performance.json`에 기록했다. 최초 networkidle 방식은 timeout으로 실패했고 콘텐츠 준비 + load 기준으로 수정 후 통과했다. E2E 동시 실행 측정은 비교에 쓰지 않고 단독 재측정했다.

| 화면 | 콘텐츠 준비 ms | JS gzip 추정 bytes | 가로 넘침 |
| --- | ---: | ---: | --- |
| 홈 | 165 | 198052 | 없음 |
| 타자 상세 20출전 | 906 | 232920 | 없음 |
| 선발 상세 5등판 | 912 | 232920 | 없음 |
| 불펜 상세 10등판 | 915 | 232920 | 없음 |
| 랭킹 | 395 | 204219 | 없음 |

390×844, 새 브라우저 context, 화면당 1회, 서버는 warm 가능. 해당 시점까지 로드된 script body gzip 추정값이며 실제 전송량이 아니다. prefetch 타이밍도 포함되어 route 전용 번들 크기로 해석할 수 없다. CPU·네트워크 제한, 이전 버전 baseline, p95, Web Vitals는 미측정이다. 차트의 기존 dynamic import와 서버 통계 계산을 유지하고 신규 클라이언트 라이브러리를 추가하지 않았다. 상세 JS의 공통 청크 분해와 반복 저사양 측정은 후속 점검 대상이다.

최종 변경 코드·테스트·스크립트 `prettier --check` 및 `git diff --check` 통과. 독립 production 성능 script와 JSON도 이번 변경 파일에 포함된다. 되돌릴 때 두 파일 역시 이번 추가분으로 처리한다.
