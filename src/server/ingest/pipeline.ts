import {
  publishMomentumBatched,
  type MomentumSnapshot,
} from "../reads/momentum";
import "server-only";
import {
  assertCanonicalPublication,
  selectedPublication,
  baselineSelected,
} from "../repositories/publication";
import {
  projectRelease,
  releaseHash,
  type Release,
} from "../repositories/release-projection";
import { scopeView } from "../reads/scope";
import { publishedBatting } from "../reads/batting";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  FileError,
  makeReport,
  rowKey,
  type Canonical,
  type Kind,
} from "./files";

export const demoRights = {
  sourceId: "demo-file-source",
  licenseId: "demo-self-authored-v1",
  status: "APPROVED",
  displayAllowed: true,
  transformAllowed: true,
  seasons: [2026],
  competitions: ["regular", "postseason", "allstar", "exhibition"],
} as const;
type DemoRights = {
  sourceId: string;
  licenseId: string;
  status: string;
  displayAllowed: boolean;
  transformAllowed: boolean;
  seasons: readonly number[];
  competitions: readonly string[];
};
type Report = ReturnType<typeof makeReport>;
type RecordVersion = {
  kind: Kind;
  row: Canonical;
  batchId: string;
  sourceId: string;
  licenseId: string;
};
type Batch = {
  raw: string;
  rows: unknown[];
  report: Report;
  validations?: Report[];
  publishedAt?: string;
  rollback?: Pick<
    PipelineState,
    | "records"
    | "aggregates"
    | "scores"
    | "momentumSnapshots"
    | "momentumCurrent"
  >;
  publishedRevision?: number;
};
export type PipelineState = {
  publication?: {
    releaseId: string;
    revision: number;
    asOf: string;
    hash: string;
  };
  releases?: Record<string, { release: Release; hash: string }>;
  momentumSnapshots?: Record<string, MomentumSnapshot>;
  momentumCurrent?: string[];
  version: 1;
  runs?: {
    batchId: string;
    phase: "VALIDATE" | "PUBLISH";
    attemptedAt: string;
    successfulAt: string | null;
    status: string;
    failReason: string | null;
    durationMs?: number;
  }[];
  audit: { action: string; batchId: string; actor: string; at: string }[];
  revision: number;
  batches: Record<string, Batch>;
  records: Record<string, RecordVersion>;
  history: {
    before?: RecordVersion;
    after?: RecordVersion;
    batchId: string;
    at: string;
    key: string;
  }[];
  events: {
    id: string;
    type: "RECALCULATE";
    at: string;
    batchId: string;
    revision: number;
    status: "COMPLETED";
    invalidated: string[];
  }[];
  aggregates: Record<
    string,
    {
      sampleSize: number;
      asOf: string;
      computedAt: string;
      pa: number;
      h: number;
      outs: number;
      er: number;
      inputRefs: string[];
    }
  >;
  scores: Record<string, unknown>;
};
const empty = (): PipelineState => ({
  version: 1,
  audit: [],
  revision: 0,
  batches: {},
  records: {},
  history: [],
  events: [],
  aggregates: {},
  scores: {},
});
export function createPipeline(
  directory = path.join(process.cwd(), ".demo", "pipeline"),
  rights: DemoRights = demoRights,
  publicStoreGuard: () => void = () => {},
  integrated = false,
) {
  const statePath = path.join(directory, "state.json");
  let publicCache:
    | { signature: string; rights: string; state: PipelineState }
    | undefined;
  async function read(): Promise<PipelineState> {
    try {
      const state = JSON.parse(
        await readFile(statePath, "utf8"),
      ) as PipelineState;
      if (state.version !== 1)
        throw new Error("지원하지 않는 DEMO 저장소 버전");
      state.audit ??= []; // Additive migration for pre-audit local demo state.
      return state;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw e;
    }
  }
  async function transaction<T>(
    work: (state: PipelineState) => T | Promise<T>,
  ): Promise<T> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = path.join(directory, "lock");
    for (let attempt = 0; ; attempt++) {
      try {
        await mkdir(lock);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (attempt >= 3)
          throw new FileError(
            409,
            "다른 게시 작업이 진행 중입니다. 다시 시도하세요.",
          );
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    try {
      const state = await read();
      const started = performance.now();
      const previousRuns = state.runs?.length ?? 0;
      const previousRevision = state.revision;
      const result = await work(state);
      if (integrated && state.revision !== previousRevision) {
        const release = projectRelease(state);
        const hash = releaseHash(release);
        (state.releases ??= {})[release.releaseId] = { release, hash };
        state.publication = {
          releaseId: release.releaseId,
          revision: release.revision,
          asOf: release.asOf,
          hash,
        };
      }
      for (const run of (state.runs ?? []).slice(previousRuns))
        run.durationMs = Math.round(performance.now() - started);
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(state));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, statePath);
      publicCache = undefined; // source/license publication and rollback invalidate all public projections. // One commit: records, audit, event and derived data become visible together.
      return result;
    } finally {
      await rm(temporary, { force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
  function context(state: PipelineState) {
    const records = Object.values(state.records);
    return {
      identities: new Map(
        records
          .filter((r) => r.kind === "players")
          .map((r) => [
            String(r.row.external_player_id),
            String(r.row.player_id),
          ]),
      ),
      games: new Set(
        records
          .filter((r) => r.kind === "games")
          .map((r) => String(r.row.game_id)),
      ),
      existing: new Map(
        Object.entries(state.records).map(([key, r]) => [key, r.row]),
      ),
    };
  }
  function rightsCheck() {
    if (
      rights.sourceId !== demoRights.sourceId ||
      rights.licenseId !== demoRights.licenseId ||
      rights.status !== "APPROVED" ||
      !rights.displayAllowed ||
      !rights.transformAllowed
    )
      throw new FileError(
        403,
        "승인된 licenseId와 displayAllowed/transformAllowed가 필요합니다.",
      );
  }
  async function readPublicState() {
    publicStoreGuard();
    rightsCheck();
    if (integrated) {
      const release = selectedPublication(statePath);
      if (release) return release.state;
      if (baselineSelected()) return empty();
    }
    // Always run before any cache lookup, including revocation.
    const currentRights = JSON.stringify(rights);
    let signature: string;
    try {
      const file = await stat(statePath, { bigint: true });
      signature = `${file.ino}/${file.size}/${file.mtimeNs}/${file.ctimeNs}`;
    } catch (error) {
      publicCache = undefined;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw error;
    }
    publicStoreGuard(); // Recheck after the asynchronous stat boundary.
    if (
      publicCache?.signature === signature &&
      publicCache.rights === currentRights
    )
      return publicCache.state;
    const state = await read();
    publicStoreGuard(); // Publication may have committed while read() awaited I/O.
    for (const record of Object.values(state.records)) {
      if (
        record.sourceId !== rights.sourceId ||
        record.licenseId !== rights.licenseId ||
        !rights.seasons.includes(Number(record.row.season)) ||
        !rights.competitions.includes(String(record.row.competition))
      )
        throw new FileError(
          403,
          "공개 기록의 출처·라이선스 범위가 일치하지 않습니다.",
        );
    }
    publicCache = { signature, rights: currentRights, state };
    return state;
  }
  return {
    read,
    readPublicState,
    async recalculateMomentum() {
      return transaction(async (state) => {
        rightsCheck();
        await publishMomentumBatched(state, new Date().toISOString());
        return state.momentumCurrent;
      });
    },
    async stage(
      kind: Kind,
      bytes: Uint8Array,
      rows: unknown[],
      fallback?: Parameters<typeof makeReport>[3],
    ) {
      return transaction((state) => {
        const report = makeReport(
          kind,
          bytes,
          rows,
          fallback
            ? { ...fallback, existing: context(state).existing }
            : context(state),
        );
        (state.runs ??= []).push({
          batchId: report.importBatchId,
          phase: "VALIDATE",
          attemptedAt: report.importedAt,
          successfulAt: null,
          status: report.status,
          failReason:
            report.issues
              .filter((i) => i.severity === "error")
              .map((i) => i.message)
              .join("; ") || null,
        });
        state.batches[report.importBatchId] = {
          raw: Buffer.from(bytes).toString("base64"),
          rows,
          report,
          validations: [structuredClone(report)],
        };
        state.audit.push({
          action: "STAGED_AND_VALIDATED",
          batchId: report.importBatchId,
          actor: "admin-capability",
          at: new Date().toISOString(),
        });
        return report;
      });
    },
    async publish(batchId: string) {
      return transaction(async (state) => {
        rightsCheck();
        const batch = state.batches[batchId];
        if (!batch) throw new FileError(404, "배치가 없습니다.");
        const run = {
          batchId,
          phase: "PUBLISH" as const,
          attemptedAt: new Date().toISOString(),
          successfulAt: null as string | null,
          status: "REJECTED",
          failReason: null as string | null,
        };
        (state.runs ??= []).push(run);
        state.audit.push({
          action: "PUBLISH_APPROVED",
          batchId,
          actor: "admin-capability",
          at: new Date().toISOString(),
        });
        if (batch.publishedAt) {
          if (!state.momentumCurrent)
            await publishMomentumBatched(state, run.attemptedAt);
          run.status = "ALREADY_PUBLISHED";
          return {
            published: true,
            revision: state.revision,
            report: batch.report,
          };
        }
        const report = makeReport(
          batch.report.kind,
          Buffer.from(batch.raw, "base64"),
          batch.rows,
          context(state),
        );
        report.importBatchId = batch.report.importBatchId;
        const error = (
          row: number,
          code: string,
          fields: string[],
          message: string,
        ) => {
          report.counts.errors++;
          report.issues.push({ row, severity: "error", code, fields, message });
        };
        const candidate = structuredClone(state.records);
        report.accepted.forEach((row) => {
          const i = batch.rows.findIndex(
            (input) =>
              input &&
              typeof input === "object" &&
              rowKey(report.kind, input as Canonical) ===
                rowKey(report.kind, row),
          );
          if (
            !rights.seasons.includes(Number(row.season)) ||
            !rights.competitions.includes(String(row.competition))
          )
            error(
              i + 1,
              "SCOPE_DENIED",
              ["season", "competition"],
              "라이선스 범위 밖입니다.",
            );
          const key = rowKey(report.kind, row),
            previous = candidate[key];
          if (
            previous &&
            report.kind === "games" &&
            ["home_team_id", "away_team_id", "doubleheader_no"].some(
              (field) => previous.row[field] !== row[field],
            )
          )
            error(
              i + 1,
              "GAME_IDENTITY_CONFLICT",
              ["game_id"],
              "기존 경기 ID를 다른 팀/더블헤더 경기로 재사용할 수 없습니다.",
            );
          if (previous && String(previous.row.as_of) > String(row.as_of))
            error(
              i + 1,
              "STALE_CORRECTION",
              ["as_of"],
              "최신 기록보다 오래된 정정입니다.",
            );
          // Repeated identical uploads retain the first published provenance.
          if (!previous || JSON.stringify(previous.row) !== JSON.stringify(row))
            candidate[key] = {
              kind: report.kind,
              row,
              batchId,
              sourceId: report.sourceId,
              licenseId: report.licenseId,
            };
        });
        const records = Object.values(candidate);
        const sameScope = (a: Canonical, b: Canonical) =>
          a.season === b.season && a.competition === b.competition;
        records.forEach((record) => {
          const r = record.row;
          const recordError = (
            row: number,
            code: string,
            fields: string[],
            message: string,
          ) =>
            error(row, code, fields, `${message} [${rowKey(record.kind, r)}]`);
          const index =
            batch.rows.findIndex(
              (input) =>
                input &&
                typeof input === "object" &&
                rowKey(record.kind, input as Canonical) ===
                  rowKey(record.kind, r),
            ) + 1;
          if (record.kind === "games") {
            if (r.status === "FINAL" && r.resumed && !r.official_final)
              recordError(
                index,
                "UNCONFIRMED_RESUMPTION",
                ["official_final"],
                "재개 경기의 최종 공식 확정이 필요합니다.",
              );
            if (
              records.some(
                (other) =>
                  other !== record &&
                  other.kind === "games" &&
                  sameScope(r, other.row) &&
                  r.played_on === other.row.played_on &&
                  r.home_team_id === other.row.home_team_id &&
                  r.away_team_id === other.row.away_team_id &&
                  r.doubleheader_no === other.row.doubleheader_no,
              )
            )
              recordError(
                index,
                "GAME_ID_COLLISION",
                ["game_id", "doubleheader_no"],
                "동일 경기 슬롯에 서로 다른 ID가 있습니다.",
              );
          }
          if (
            !["batting_game_logs", "pitching_game_logs"].includes(record.kind)
          )
            return;
          const game = records.find(
            (g) =>
              g.kind === "games" &&
              sameScope(r, g.row) &&
              g.row.game_id === r.game_id,
          )?.row;
          const player = records.find(
            (p) =>
              p.kind === "players" &&
              sameScope(r, p.row) &&
              p.row.external_player_id === r.external_player_id,
          );
          if (!game || !player) {
            recordError(
              index,
              "MISSING_SCOPED_REFERENCE",
              ["game_id", "external_player_id"],
              "같은 시즌·대회의 경기와 선수가 필요합니다.",
            );
            return;
          }
          // Non-final appearances are removed below, never counted. A resumed game requires contract confirmation.
          if (game.status !== "FINAL") return;
          if (player.row.person_type === "COACH" || player.row.role === "COACH")
            recordError(
              index,
              "COACH_APPEARANCE",
              ["external_player_id"],
              "코치는 선수 출전 기록을 가질 수 없습니다.",
            );
          if (
            new Date(Date.parse(String(r.as_of)) + 9 * 3600000)
              .toISOString()
              .slice(0, 10) < String(game.played_on)
          )
            recordError(
              index,
              "INVALID_AS_OF",
              ["as_of"],
              "기록 기준시각이 경기 날짜보다 빠릅니다.",
            );
          if (game.resumed && !game.official_final)
            recordError(
              index,
              "UNCONFIRMED_RESUMPTION",
              ["official_final"],
              "재개 경기의 최종 공식 확정이 필요합니다.",
            );
          if (![game.home_team_id, game.away_team_id].includes(r.team_id))
            recordError(
              index,
              "TEAM_MISMATCH",
              ["team_id"],
              "경기 참가 팀이 아닙니다.",
            );
          const roster = records.find(
            (p) =>
              p.kind === "rosters" &&
              sameScope(r, p.row) &&
              p.row.external_player_id === r.external_player_id &&
              p.row.snapshot_on === game.played_on,
          )?.row;
          if (
            !roster ||
            roster.status !== "REGISTERED" ||
            roster.person_type === "COACH" ||
            roster.team_id !== r.team_id
          )
            recordError(
              index,
              "ROSTER_MISMATCH",
              ["team_id", "snapshot_on"],
              "경기 날짜의 등록 로스터와 일치해야 합니다.",
            );
        });
        (batch.validations ??= [structuredClone(batch.report)]).push(
          structuredClone(report),
        );
        batch.report = {
          ...report,
          status: report.counts.errors ? "REJECTED" : "VALIDATED",
        };
        if (report.counts.errors) {
          run.failReason = report.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; ");
          return {
            published: false,
            revision: state.revision,
            report: batch.report,
          };
        }
        // A cancellation/correction also retracts previously published appearances.
        for (const [key, record] of Object.entries(candidate)) {
          if (
            !["batting_game_logs", "pitching_game_logs"].includes(record.kind)
          )
            continue;
          const game = records.find(
            (g) =>
              g.kind === "games" &&
              sameScope(record.row, g.row) &&
              g.row.game_id === record.row.game_id,
          )?.row;
          if (game?.status !== "FINAL") delete candidate[key];
        }
        for (const previous of Object.values(state.batches))
          delete previous.rollback;
        batch.rollback = structuredClone({
          records: state.records,
          aggregates: state.aggregates,
          scores: state.scores,
          momentumSnapshots: state.momentumSnapshots,
          momentumCurrent: state.momentumCurrent,
        });
        const at = new Date().toISOString();
        const changed = [
          ...new Set([
            ...Object.keys(candidate),
            ...Object.keys(state.records),
          ]),
        ].filter(
          (key) =>
            JSON.stringify(candidate[key]?.row) !==
            JSON.stringify(state.records[key]?.row),
        );
        for (const key of changed)
          state.history.push({
            before: state.records[key],
            after: candidate[key],
            batchId,
            at,
            key,
          });
        if (changed.length) {
          const invalidated = Object.keys(state.scores);
          state.scores = {};
          state.aggregates = {};
          state.revision++;
          for (const [key, record] of Object.entries(candidate)) {
            const r = record.row;
            if (
              !["batting_game_logs", "pitching_game_logs"].includes(record.kind)
            )
              continue;
            const aggregateKey = JSON.stringify([
              r.season,
              r.competition,
              r.player_id,
              r.role ?? "BATTER",
            ]);
            const aggregate = (state.aggregates[aggregateKey] ??= {
              sampleSize: 0,
              asOf: String(r.as_of),
              computedAt: at,
              pa: 0,
              h: 0,
              outs: 0,
              er: 0,
              inputRefs: [],
            });
            aggregate.sampleSize++;
            if (String(r.as_of) > aggregate.asOf)
              aggregate.asOf = String(r.as_of);
            for (const field of ["pa", "h", "outs", "er"] as const)
              aggregate[field] += Number(r[field] ?? 0);
            aggregate.inputRefs.push(key);
          }
          state.events.push({
            id: randomUUID(),
            type: "RECALCULATE",
            at,
            batchId,
            revision: state.revision,
            status: "COMPLETED",
            invalidated,
          });
        }
        state.records = candidate;
        if (changed.length) await publishMomentumBatched(state, at);
        run.status = "PUBLISHED";
        run.successfulAt = at;
        batch.publishedAt = at;
        batch.publishedRevision = state.revision;
        batch.report.status = "PUBLISHED";
        batch.report.published = true;
        state.audit.push({
          action: "PUBLISHED",
          batchId,
          actor: "admin-capability",
          at,
        });
        return {
          published: true,
          revision: state.revision,
          report: batch.report,
        };
      });
    },
    async rollback(batchId: string) {
      return transaction((state) => {
        rightsCheck();
        const batch = state.batches[batchId];
        if (
          state.audit.findLast((e) => e.action === "PUBLISHED")?.batchId !==
            batchId ||
          !batch?.rollback ||
          batch.publishedRevision !== state.revision ||
          !batch.publishedAt
        )
          throw new FileError(409, "최신 게시 배치만 되돌릴 수 있습니다.");
        Object.assign(state, batch.rollback);
        state.revision++;
        delete batch.rollback;
        delete batch.publishedAt;
        batch.report.status = "VALIDATED";
        batch.report.published = false;
        state.audit.push({
          action: "ROLLED_BACK",
          batchId,
          actor: "admin-session",
          at: new Date().toISOString(),
        });
        return { rolledBack: true, revision: state.revision };
      });
    },
    async scope(input: Parameters<typeof scopeView>[1]) {
      const state = await readPublicState();
      const records = Object.values(state.records).filter(
        (r) =>
          r.row.season === input.season &&
          r.row.competition === input.competition,
      );
      return scopeView(state, input, records);
    },
    async publicResults(season: number, competition: string) {
      const state = await readPublicState();
      return {
        demo: true,
        sourceId: rights.sourceId,
        licenseId: rights.licenseId,
        revision: state.revision,
        records: Object.values(state.records).filter(
          (r) => r.row.season === season && r.row.competition === competition,
        ),
        battingStats: publishedBatting(
          Object.values(state.records).filter(
            (r) => r.row.season === season && r.row.competition === competition,
          ),
        ),
        aggregates: Object.fromEntries(
          Object.entries(state.aggregates).filter(([key]) => {
            const scope = JSON.parse(key);
            return scope[0] === season && scope[1] === competition;
          }),
        ),
      };
    },
  };
}
export const pipeline = createPipeline(
  path.join(
    process.cwd(),
    ".demo",
    process.env.INGEST_E2E === "1" ? "pipeline-e2e" : "pipeline",
  ),
  demoRights,
  assertCanonicalPublication,
  true,
);
