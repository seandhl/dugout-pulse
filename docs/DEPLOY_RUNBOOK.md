# DEMO 배포 운영 절차

확인일: 2026-11-03 (Asia/Seoul). 외부 서비스는 생성하지 않았으며 배포 URL은 **없음**.
사이트 주소 placeholder: `https://dugout-pulse.invalid`. 실제 주소·운영자·문의 창구 확정 전 검토용 DEMO만 허용한다.

## 선택 및 현재 지원 확인

- 호스팅: **Render Docker Web Service**. [Docker 빌드](https://render.com/docs/docker), [health check](https://render.com/docs/health-checks)를 지원한다. Node native runtime 지원 버전을 추정하지 않고 Docker에서 프로젝트의 Node 26.11.0을 고정한다. 이미지 tag의 실제 다운로드 가능 여부는 Docker 환경에서 사전 확인해야 한다.
- [Render 배포](https://render.com/docs/deploys)는 디스크 부착 시 무중단 배포에 제약이 있다. 이번 공개 데모는 디스크 없이 이미지 내 재생성 가능한 fixture만 사용한다. 단일 인스턴스, 관리자 비활성, 재시작 시 로컬 변경 유실을 전제로 한다.
- PostgreSQL: **Neon**, PostgreSQL 17 선택 제안. [17 지원 안내](https://neon.com/blog/postgres-17), [pooling](https://neon.com/docs/connect/connection-pooling), [백업](https://neon.com/docs/postgres/backup-restore/backups)을 확인했다. 관리 작업·dump/restore에는 direct TLS 연결을 사용하고 pooled endpoint를 쓰지 않는다. 지역별 생성 가능 버전은 콘솔에서 재확인한다.
- [Neon 요금](https://neon.com/pricing)은 Free와 사용량 기반 유료 요금제를 구분한다. 현재 앱은 PostgreSQL adapter/client가 연결되지 않았으므로 **Neon 생성은 데모 구동에 불필요**하다. PostgreSQL 문서와 SQL deploy는 후속 준비이며 완료된 연동으로 표시하지 않는다.
- [Render 로그 보존](https://render.com/docs/logging): Hobby 7일, Pro 14일, Scale/Enterprise 30일. 앱은 배포 환경에서 허용 필드만 stdout에 기록한다. 호스팅 access log의 개인정보는 별도 처리 조건 확인 대상이다. 7일 초과 요금제는 개인정보 고지와 보존 정책을 갱신한 뒤 선택한다.

## 비용·권한 경계

이번 작업은 설치·유료 생성·DNS 변경·외부 배포·커밋·푸시를 실행하지 않았다.
다음 동작은 **실행 전에 소유자의 비용 승인**을 받는다: Render 유료 인스턴스·디스크·로그 전송, Neon 유료 전환·compute/저장소/전송/restore history 증가·추가 branch, 백업 외부 저장소·도메인 구매. 무료 플랜도 한도·정지·과금 전환 정책을 콘솔에서 확인한다. 가격 총액을 보장하지 않는다. Docker build는 패키지와 base image를 다운로드하므로 설치 금지 해제 후 수행한다. DNS 변경은 별도 명시 승인 후에만 수행한다.

## 환경 분리와 비밀

모든 환경은 `DATA_MODE=DEMO`, `DEMO_PROFILE=default`만 사용한다. `NODE_ENV=production`은 Next 실행 모드이고 `APP_ENV`는 서비스 구분이다. production이 실데이터를 뜻하지 않는다.

| 항목 | demo | staging | production |
| --- | --- | --- | --- |
| APP_ENV | demo | staging | production |
| PUBLICATION_STATE | demo 또는 maintenance | 동일 | 동일 |
| SITE_URL | 확정 전 비움 | 별도 HTTPS origin | 별도 HTTPS origin |
| DATABASE_URL | 미설정 | 앱에는 미설정 | 앱에는 미설정 |
| 관리자 비밀 4종 | 모두 미설정 | 모두 미설정 | 모두 미설정 |

Render 서비스를 환경별로 별도 구성하고 비밀을 복사·공유하지 않는다. `.env.example`은 값 없는 항목 목록만 버전 관리한다. 로컬 private 파일을 쓰면 `chmod 600`하고 secret manager에서 주입한다. `.env.production`은 staging에도 자동 로드될 수 있으므로 공유 checkout에 두지 않는다. `NEXT_PUBLIC_*`에 비밀을 넣지 않는다. 빌드 컨텍스트에서 `.env*`를 제외한다. URL에 인증정보를 넣어 셸 history/로그에 노출하지 않는다. 노출 시 해당 비밀을 폐기·재발급하고 이미지/로그 유출 범위를 확인한다.

`APP_ENV`가 local 이외이면 proxy와 관리자 서버 권한 검사 모두 관리자 요청을 거부한다. 환경별 DB가 필요해지는 후속 단계에는 별도 Neon 프로젝트·별도 role을 사용한다. 실데이터 DB의 branch를 demo로 복제하지 않는다.

## 로컬 설치 및 production 검증

기존 설치가 있으면 install 없이 시작한다. 새 환경 설치는 패키지 설치 승인 후 다음을 사용한다.

```sh
# Node 26.11.0 / pnpm 12.10.1
pnpm install --frozen-lockfile
pnpm db:seed
APP_ENV=staging DATA_MODE=DEMO NEXT_TELEMETRY_DISABLED=1 pnpm build
APP_ENV=staging DATA_MODE=DEMO PUBLICATION_STATE=demo pnpm start --port 3200
# 다른 터미널
SMOKE_BASE_URL=http://127.0.0.1:3200 pnpm deploy:smoke
node scripts/demo-backup-rehearsal.mjs
# 수동 서버 종료 후, 3200/3201 포트가 비어 있을 때 자동 정상/점검 smoke
node scripts/deploy-local-smoke.mjs
pnpm lint
pnpm test
```

화면 확인: `/`, `/players`, `/players/demo_0_00`, `/about`, `/legal`, `/privacy`, `/data-terms`. footer에서 고지에 키보드로 접근할 수 있다. `/api/ready`의 importStatus는 **외부 import 성공이 아니라 canonical fixture 검증**이다. `/api/admin/ingest/status`는 403이어야 한다. 상세 import 상태는 로컬 승인 관리자만 기존 `/api/admin/ingest/status`에서 확인한다.

## 수동 Render 배포 (아직 실행하지 않음)

1. 현재 Git 루트가 홈이므로 홈을 탐색/스테이징하지 않는다. 별도 저장소와 업로드 권한을 확정한 후 이 프로젝트만 업로드한다. `.dockerignore`로 비밀·로컬 DB·로그가 제외되는지 검토한다.
2. 승인된 환경에서 `docker build -t dugout-pulse:demo .` 실행. `docker run --rm -p 3200:10000 -e APP_ENV=staging dugout-pulse:demo` 후 위 smoke를 실행한다. 현재 Docker 미설치로 이 검증은 미실행이다.
3. Render에서 Docker Web Service, Dockerfile=`./Dockerfile`, 단일 인스턴스, auto deploy 비활성, 디스크 없음으로 설정한다. 플랜 선택·생성 버튼 전 비용을 고지하고 승인받는다. 컨테이너는 non-root로 실행하며 `0.0.0.0:$PORT`에 바인딩한다. 로컬 `pnpm start`는 loopback 전용이다.
4. 표의 환경변수를 서비스별 설정한다. health check path는 `/api/ready`. 정상이어야 트래픽을 받도록 하고 `/api/health`는 프로세스 생존 진단에만 사용한다. 점검 모드는 readiness 503이므로 Render가 새 배포를 승격하지 않을 수 있다. 긴급 차단은 아래 서비스 suspend 절차를 따른다.
5. 제공자가 실제 발급한 staging URL로 `SMOKE_BASE_URL=<실제 HTTPS URL> pnpm deploy:smoke` 실행한다. URL을 추정해서 기록하지 않는다. 통과한 동일 코드/이미지와 환경 분리로 production을 수동 승격한다.
6. 확정된 `SITE_URL`로 다시 빌드·배포한다(정적 metadata에 반영). 미설정 시 `.invalid` placeholder이며 등록된 도메인이 아니다. 실제 DNS 변경은 이 절차에 포함하지 않는다.
7. 배포 기록에 commit/image digest, 환경, fixture hash, smoke 결과, 승인자, 비용 플랜, UTC/KST 시각, 실제 URL을 남긴다. noindex는 접근 통제가 아니므로 비공개 검토에는 호스팅 접근 제한을 별도로 적용한다.

## DEMO·스키마 fail-safe

- `DATA_MODE`는 DEMO만 허용한다. 빌드/시작 및 readiness에서 검증한다. PostgreSQL URL이 설정돼도 앱 composition은 canonical SQLite DEMO만 읽으며 자동 전환하지 않는다.
- seed는 SQLite `user_version=1`을 같은 트랜잭션에 기록한다. 읽기는 파일 변경 후 스키마·payload SHA-256·원본 합성 generator와 완전 일치를 검증한다. 누락·변조·다른 스키마면 503이고 이전 캐시를 폐기한다. 구버전 DB를 자동 승인하지 않는다. `pnpm db:seed`로 재생성하고 readiness를 재확인한다.
- home snapshot의 release hash 검증은 기존 읽기 경계를 유지한다. 개별 API 오류도 운영 모니터링에서 확인한다. readiness 하나가 전체 데이터 계약 검사를 대신하지 않는다.
- 배포 DEMO는 업로드·게시·rollback 관리자 API를 모두 차단한다. 합성 fixture를 실제 선수 자료로 교체하거나 실데이터 adapter를 활성화하는 작업은 별도 권리 검토·마이그레이션·검증이 필요하다.

## PostgreSQL migration deploy (선택적 준비, 미실행)

현재 `pnpm db:migrate`는 Prisma CLI 미설치로 실행 불가다. 패키지를 몰래 설치하지 않는다. 대신 `pnpm db:deploy:sql`은 기존 SQL을 checksum ledger와 session advisory lock으로 순차 적용한다. Prisma ledger와 **호환되는 도구가 아니므로 혼용하지 않는다**. 이미 Prisma로 관리된 DB에는 실행하지 않는다. 빈 전용 DEMO DB에서만 최초 도입한다. SQL 내용의 checksum 변경 시 중단하며 migration별 트랜잭션을 사용한다. 일부 migration 성공 뒤 실패하면 ledger 확인 후 원인 수정·재실행한다. 데이터 테이블 임의 drift의 자동 탐지는 구현하지 않았다.

PostgreSQL 17 client 도구를 승인된 관리 환경에 준비하고, private `pg_service.conf`/`pgpass`에 `dugout_staging_migrator`, `dugout_staging_readonly`, `dugout_restore_drill` service를 만든다. 실제 값은 저장소에 두지 않는다. `sslmode=verify-full` 및 신뢰 CA를 설정한다. direct endpoint, 서로 다른 DB인지 확인한다.

```sh
# 비밀을 출력하지 않는 연결 확인
PGSERVICE=dugout_staging_migrator psql -X --no-password -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'
PGSERVICE=dugout_staging_migrator CONFIRM_DEMO_DB=yes pnpm db:deploy:sql
# 같은 명령 재실행: 변경 없는 migration은 skip
PGSERVICE=dugout_staging_migrator CONFIRM_DEMO_DB=yes pnpm db:deploy:sql
PGSERVICE=dugout_staging_migrator psql -X --no-password -v ON_ERROR_STOP=1 -c 'TABLE public.dugout_deploy_migrations;'
```

application role에는 DDL을 주지 않는다. 승인 관리자가 `dugout_reader` LOGIN role을 별도 발급한 뒤 다음을 실행하고 reader 연결에서 쓰기 실패를 확인한다. demo 앱에는 reader 비밀조차 주입하지 않는다.

```sql
GRANT CONNECT ON DATABASE neondb TO dugout_reader; -- 실제 전용 DB명 확인 후 변경
GRANT USAGE ON SCHEMA public TO dugout_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dugout_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dugout_reader;
ALTER ROLE dugout_reader SET default_transaction_read_only = on;
```

기존 PUBLIC/role 쓰기 권한을 검토·제거해야 한다. read_only 설정만을 권한 방어로 간주하지 않는다. 향후 PostgreSQL 앱 도입 시 ledger checksum·필수 schema 검사 실패를 readiness/읽기에 연결하기 전에는 공개 트래픽을 허용하지 않는다.

## 백업·복원 리허설

실제 DEMO는 이미지/seed로 복구 가능하다. `node scripts/demo-backup-rehearsal.mjs`는 현재 DB의 일관된 `VACUUM INTO` 백업을 임시 위치에 복원하고 integrity, schema, payload hash와 12 snapshot을 검증한다. 원본을 덮어쓰지 않고 종료 시 임시본을 삭제한다. 장기 백업은 암호화 저장소에 저장하며 자격증명·원본 업로드·개인정보를 불필요하게 포함하지 않는다.

PostgreSQL은 별도 빈 복원 DB에만 다음을 수행한다. 서비스 이름이 달라도 같은 DB일 수 있으므로 host/DB를 관리 콘솔에서 대조한다. 유료 compute/branch/storage를 발생시킬 수 있어 먼저 승인받는다.

```sh
umask 077
mkdir -p /private/tmp/dugout-backup
PGSERVICE=dugout_staging_migrator pg_dump --no-password --format=custom --no-owner --no-acl --file=/private/tmp/dugout-backup/staging.dump
pg_restore --list /private/tmp/dugout-backup/staging.dump
# restore_drill은 비어 있는 별도 DB여야 한다. --clean 사용 금지
PGSERVICE=dugout_restore_drill pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-acl --dbname='service=dugout_restore_drill' /private/tmp/dugout-backup/staging.dump
PGSERVICE=dugout_restore_drill psql -X --no-password -v ON_ERROR_STOP=1 -c 'TABLE public.dugout_deploy_migrations;'
PGSERVICE=dugout_restore_drill CONFIRM_DEMO_DB=yes pnpm db:deploy:sql
```

복원본 ledger와 주요 테이블별 행 수를 원본 dump 시점 기록과 비교하고 reader SELECT/쓰기 거부를 확인한다. 계약·출처 상태를 재확인한 후에만 전환한다. 매 배포 전 백업, 일간 백업·7일 보존을 초기 목표로 제안한다. 담당자·스케줄러·암호화·자동 삭제는 미구성이다. 목표 RPO 24시간/RTO 60분은 측정 SLA가 아니다. Neon PITR history와 보존 비용은 선택 플랜별 콘솔에서 확인하며 독립 dump를 대체하지 않는다. 복원 시각/소요시간/행 수/권한/실패와 복구 결과를 기록한다.

## rollback · 장애 · 권리 대응

1. 데이터 제공 중단·계약 만료·오류·권리 신고 시 **게시부터 중단**한다. 실데이터로 fallback하지 않는다. Render suspend 또는 제공자의 maintenance 기능으로 즉시 트래픽을 차단한다. readiness 실패만으로 기존 정상 인스턴스가 즉시 내려간다고 가정하지 않는다.
2. 앱 점검 안내는 `PUBLICATION_STATE=maintenance`로 재시작하면 동작한다. `/`와 데이터 API는 503 + no-store, 법적 고지와 health는 접근 가능, readiness는 503이다. 호스팅 배포 승격을 기다릴 수 없는 긴급 상황에는 먼저 suspend한다. 운영자용 maintenance URL은 확정 전 placeholder로 두고 가짜 주소를 등록하지 않는다.
3. 로컬 재현:

```sh
APP_ENV=staging PUBLICATION_STATE=maintenance pnpm start --port 3201
# 다른 터미널
SMOKE_BASE_URL=http://127.0.0.1:3201 SMOKE_MAINTENANCE=1 pnpm deploy:smoke
```

4. 오류 로그는 허용 필드(status/code/duration/count)만 수집한다. 로그에 요청 본문·인증정보·개인정보를 추가하지 않는다. 공개 캐시/CDN이 추가됐다면 invalidate하고 이미 열린 브라우저/다운로드 자료를 원격 회수할 수 없음을 기록한다.
5. 코드 rollback은 Render에서 마지막 smoke 통과 이미지/배포로 수동 복귀하고 환경값을 별도 점검한다. 그 버전과 맞는 fixture를 재생성한다. 자동 down migration은 없다. DB 변경은 additive/expand-contract를 기본으로 하며 복원본 검증 후 연결 전환 또는 forward fix를 택한다. production 원본 위에 pg_restore/`db:reset` 실행 금지.
6. 권리 문제는 `docs/DATA_RIGHTS.md`와 `docs/RELEASE_GATES.md`에 source/license/status/유효기간/허용 필드/attribution/철회 증빙을 갱신한다. 승인 기록이 없으면 게시하지 않는다. 관련 원본·파생 snapshot·export/cache를 격리·삭제하고 법적 보존 의무는 담당자가 확인한다. 백업에서 복원해도 철회된 자료는 다시 게시하지 않는다.
7. 재개는 권리 유효성 재검토, canonical seed/readiness, 정상 smoke, 법적 고지/문의 창구 확인 뒤 수동으로 진행한다. 담당자 미정이므로 자동 복구·자동 재게시·외부 알림 연동은 구성하지 않았다.

## 검증 기록과 남은 게이트

local production build 및 정상/maintenance HTTP smoke, SQLite 복원 리허설 결과는 README 배포 절에 기록한다. Docker 빌드·실제 Render 배포·PostgreSQL SQL deploy/복원 리허설은 도구/계정 미구성으로 미실행이다. 이 상태를 PostgreSQL 운영 준비 완료로 표시하지 않는다. 공개 출시 전 담당자·문의·호스팅 개인정보 처리 조건, 비용 승인, 독립 저장소, 실제 staging URL에서 동일 smoke가 추가로 필요하다.

검증 기록(2026-11-03): production build 및 자동 정상/점검 HTTP smoke 통과, SQLite 복원 리허설 통과, lint/typecheck 통과. 전체 단위 테스트 232개 통과·1개 건너뜀 후 추가 배포/스키마 회귀 6개 통과. 샌드박스의 loopback EPERM은 허용 실행 환경에서 재실행해 해결했다. 실제 외부 URL/DNS/DB는 생성하지 않았다.
