# 데이터 권리 출시 게이트

기준일: 2026-11-03 (Asia/Seoul). 근거: [DATA_RIGHTS](DATA_RIGHTS.md), [ADR-001/007](DECISIONS.md), [PRD AC-18/19](PRD.md). 현재 운영 모드 **DEMO**, 실제 데이터 출시 **BLOCKED**, 데모 공개 출시 **NOT_READY**(앱·fixture·출시 검수 없음).

## 1. Launch gate (채택)

**공개 서비스에서 실제 KBO 데이터를 사용할 때는 구체적 라이선스가 문서화되어 있고, 해당 데이터를 저장/가공/노출할 권한까지 확인되어야 한다. 그렇지 않으면 데모만 공개한다.** 데모도 아래 공통 출시 검수를 통과해야 한다. 출처 표기, 공개 웹페이지, 인증 성공, 파일 보유, 문서 검사 통과는 라이선스를 대신하지 않는다.

아래 체크는 미실행이면 미체크로 유지한다. 결과마다 명령·환경·대상 버전/해시·시각·검토자·증빙 참조를 기록한다. `pending`, `rejected`, 누락, 만료, 서로 모순되는 상태는 기본 거부한다. 문서상 approved만으로 배포하지 않는다.

## 2. 기계적 체크리스트

현재 실행 가능한 검사는 아래 **문서 정합성 검사뿐**이다. 앱/CI/데이터 검증기는 미구현이며 다음 항목들은 P1/P2/P4/P5 구현·실행 조건이다.

- [x] M-01: 두 필수 문서 존재, A/B/C pending·D approved 및 DEMO 기본값, 원문 링크·시행일 확인(아래 명령).
- [ ] M-02 (P2): 모든 수입 배치의 sourceId/rightsRecordId가 권리 대장에 존재하고 용도와 일치. 알 수 없는 소스·빈 증빙·미승인·만료·철회·혼합 실제/가상 입력은 서버에서 거부.
- [ ] M-03 (P2/P4): DEMO 모드에서 실제 입력·외부 어댑터·게시 요청 거부. 공개 응답/정적 산출물/캐시도 가상 데이터만 포함. 필수 추적 필드 누락 거부; 파생 수치 원천 연결 보존.
- [ ] M-04 (P4): 모든 데이터 화면·카드의 DEMO·출처·as-of·시즌·대회·표본 표시와 공개 필드 허용 목록 검사. 관리자 직접 요청의 인증·권한 거부 검사.
- [ ] M-05 (P5): 실제 모드는 공급자별 유효한 증빙 참조·법무/운영 승인·저장/가공/노출 권한을 필수 검사. 최소한 승인/미승인/만료/철회/권리 하나 누락의 양성·음성 사례 실행. 상태 변경 후 과거 배치 복구·캐시 노출도 차단.
- [ ] M-06 (P5): 배포 산출물의 소스/자산 목록 대조, 비밀·증빙 원문 노출 검사. 무허가 수집 코드·의존성·스케줄러 없음 확인. 데이터 다운로드/내보내기는 별도 재배포 권한 없으면 차단.

프로젝트 루트에서 패키지 설치·네트워크 없이 실행:

```sh
python3 - <<'PY'
from pathlib import Path
import re

root = Path.cwd()
rights = (root / 'docs/DATA_RIGHTS.md').read_text()
gates = (root / 'docs/RELEASE_GATES.md').read_text()
assert '현재 운영 모드: **DEMO**' in rights
assert '2026-10-14' in rights
assert 'https://www.koreabaseball.com/kbo/board/notice/View.aspx?boardSe=12148' in rights
rows = [line for line in rights.splitlines() if line.startswith('| 결론 |')]
assert len(rows) == 1
cells = [cell.strip() for cell in rows[0].split('|')[1:-1]]
assert len(cells) == 5
assert [re.search(r'\*\*(approved|pending|rejected)\*\*', cell).group(1)
        for cell in cells[1:]] == ['pending', 'pending', 'pending', 'approved']
for field in ['공급자', '계약/약관 링크', '허용 범위', '금지 범위', '갱신 주기',
              '원본 저장 가능 여부', '가공 후 공개 가능 여부', '표기 의무',
              '법무 확인', '만료일', '담당자']:
    row = next(line for line in rights.splitlines() if line.startswith('| ' + field + ' |'))
    values = [cell.strip() for cell in row.split('|')[1:-1]]
    assert len(values) == 5 and all(values), field
assert '실제 데이터 출시 **BLOCKED**' in gates
assert '데모 공개 출시 **NOT_READY**' in gates
for doc in [root / 'docs/DATA_RIGHTS.md', root / 'docs/RELEASE_GATES.md']:
    for target in re.findall(r'\]\(([^)]+)\)', doc.read_text()):
        if not target.startswith(('https://', 'http://', '#')):
            assert (doc.parent / target.split('#')[0]).is_file(), target
print('PASS: P0 문서 정합성만 확인; 실제 권리 승인/앱 테스트/출시 승인 아님')
PY
```

이 검사는 현 P0 판정의 의도치 않은 변경과 누락만 감지한다. 계약 진위·법적 효력·데이터 내용·화면·실행 중 권리 차단을 검증하지 않는다. 향후 승인 전환 시 근거와 ADR을 검토한 뒤 검사 기대값을 함께 갱신한다. 검사 결과를 맞추려고 대장만 approved로 바꾸지 않는다.

## 3. 수동 체크리스트

공통(데모 포함):

- [ ] H-01: 배포 대상의 데이터/자산 전체 목록과 해시를 작성하고 숨은 캐시·백업·정적 페이지·미리보기·공유 이미지까지 확인.
- [ ] H-02: 가상 데이터 제작자·제작 이력·외부 기록 미혼입 검수. 실제 선수·구단으로 오인시키는 이름/수치/도형 없음. 모든 데이터 화면과 카드의 `DEMO · 가상 데이터` 직접 확인.
- [ ] H-03: 로고·엠블럼·사진·초상·폰트·아이콘 등 개별 자산의 허용 범위·표시 확인; 미확인 자산 제거. 데이터 계약에 자산 권한을 추정하지 않음.
- [ ] H-04: 담당자 실명은 비공개 승인 기록에 지정하고 공개 문서에는 역할/참조만 기록. 문의·운영 주체·필수 고지·개인정보·접근성·보안·복구 및 PRD/로드맵의 P5 기준 충족.

실제 데이터 추가 조건(A/B/C 중 채택한 각 소스에 모두 적용):

- [ ] H-05: 공급자·원권리자·제3자 재허락 권원과 서명/승인된 계약·공식 약관 버전 검토. B는 공식 API 및 정식 인증 자격, C는 해당 파일·배치의 라이선스 확인.
- [ ] H-06: 서비스 목적·범위·필드·시즌·대회·상업 이용·재배포·갱신 빈도·서버 저장·캐시/백업·가공·공개에 대한 조항 매핑. 실제 노출하는 원본/파생물 각각 허용 확인.
- [ ] H-07: 출처 표기 문구·위치·갱신/정정 의무 검수. 시작일·만료일·철회·종료 후 삭제/보관·파생물 처리 계획 확인.
- [ ] H-08: 법무 검토와 운영 책임자의 명시적 승인, 대상 증빙 버전·배치·용도·검토일·다음 검토일 기록. 미확인 필드 없음.
- [ ] H-09: 만료·철회 시 수입/게시/노출 중단, 실제 캐시·과거 배치 복구 차단, 가상 배치/빈 상태 전환과 삭제 의무 이행 절차 리허설.

## 4. 판정표와 기록

| 조건 | 공개 가능한 범위 |
| --- | --- |
| 계약 없음/권리 미확인/만료/철회 | 실제 데이터 금지; 공통 검수 완료한 DEMO만 가능 |
| 대장 approved이나 기계/수동 검사 미완료 | 실제 데이터 출시 보류 |
| 사용 중인 모든 실제 소스의 구체적 라이선스·저장/가공/노출 권한, 자산 권리, 관련 검사 및 수동 승인 완료 | 승인된 범위에 한해 실제 모드 가능; 별도 ADR 필요 |
| DEMO 정책만 승인, 앱·fixture·P5 검수 없음(현재) | DEMO 개발만 가능; 공개 출시 NOT_READY |

릴리스마다 기록: 릴리스 ID/코드 버전, 모드, source/rights/batch/asset ID와 해시, 증빙 버전/안전한 참조, M/H 항목별 pass/fail/not-run 및 사유, 명령/결과/시각, 법무·운영 승인 참조, 만료/다음 검토일, 최종 allow/block 및 복구 대상. 민감한 증빙과 개인정보는 공개하지 않는다. 증빙 링크 접근 불가도 확인 완료로 표시하지 않는다.

현재 실행 기록: 2026-11-03 (Asia/Seoul), 작성 에이전트가 프로젝트 루트에서 위 Python 3 문서 정합성 명령을 실행하여 exit 0 / PASS를 확인했다. 대상은 본 작업의 P0 문서이며 법무·운영 승인자가 검토한 기록이 아니다. M-02~06, H-01~09는 대상 앱·fixture·계약·담당자 또는 출시 검수 부재로 **미실행**. 이 문서 작성은 출시 승인이 아니다.

## 5. 보안 출시 차단 (2026-11-03)

**보안 공개 출시 BLOCKED — DEMO 포함.** [SECURITY_REVIEW](SECURITY_REVIEW.md)의 미해소 고위험 가능 항목에 따라 전체 의존성 감사 성공과 critical/high 처리, 운영 관리자 VPN/ACL·TLS·환경 분리 및 공유 요청 제한 검증 전에는 공개 배포하지 않는다. 현재 registry DNS 실패로 audit 미완료이며 Prisma 의존성 누락으로 build/typecheck 실패, 단위 테스트 1개 timeout도 남아 있다. 담당자가 해당 증빙과 재검증을 기록하기 전에는 게이트를 해제하지 않는다. 코드 수정/문서 검사/부분 테스트 통과는 출시 승인이 아니다.
