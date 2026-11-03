import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { ApiError } from "../http/errors";
import { releaseHash, type Release } from "./release-projection";

const legacyState = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    records: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export const baselineReleaseId = () =>
  process.env.DEMO_PROFILE === "performance"
    ? "synthetic_performance_v1"
    : "synthetic_v2";
export const publicationPath = () =>
  resolve(
    process.cwd(),
    ".demo",
    process.env.INGEST_E2E === "1" ? "pipeline-e2e" : "pipeline",
    "state.json",
  );
type Selection = { requested?: string; loaded?: boolean; release?: Release };
const selection = new AsyncLocalStorage<Selection>();
export function withPublication<T>(
  requested: string | undefined,
  run: () => T,
): T {
  return selection.run({ requested }, run);
}
function unavailable(): never {
  throw new ApiError(
    "STALE_DATA",
    503,
    "게시 릴리스 연결 대기 중입니다. 서로 다른 수정본의 공개 조회를 차단했습니다.",
  );
}
export function selectedPublication(
  filename = publicationPath(),
): Release | undefined {
  const context = selection.getStore();
  if (context?.loaded) return context.release;
  let release: Release | undefined;
  try {
    let raw: string;
    try {
      raw = readFileSync(filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      raw = '{"version":1,"revision":0,"records":{}}';
    }
    const state = legacyState.parse(JSON.parse(raw));
    if (state.revision !== 0 || Object.keys(state.records).length) {
      const manifest = state.publication as
        | { releaseId: string; revision: number; asOf: string; hash: string }
        | undefined;
      const entries = state.releases as
        | Record<string, { release: Release; hash: string }>
        | undefined;
      const active = manifest && entries?.[manifest.releaseId];
      if (
        !manifest ||
        !active ||
        manifest.revision !== state.revision ||
        active.hash !== manifest.hash ||
        releaseHash(active.release) !== active.hash ||
        active.release.revision !== state.revision ||
        active.release.asOf !== manifest.asOf ||
        JSON.stringify(active.release.state.records) !==
          JSON.stringify(state.records)
      )
        unavailable();
      const requested = context?.requested;
      if (requested !== baselineReleaseId()) {
        const entry = requested ? entries?.[requested] : active;
        if (!entry || releaseHash(entry.release) !== entry.hash) unavailable();
        release = entry.release;
        if (
          release.schemaVersion !== 1 ||
          release.fixture.releaseId !== release.releaseId ||
          release.fixture.asOf !== release.asOf ||
          release.state.revision !== release.revision ||
          !release.fixture.demo
        )
          unavailable();
        for (const record of Object.values(release.state.records))
          if (
            record.sourceId !== "demo-file-source" ||
            record.licenseId !== "demo-self-authored-v1" ||
            record.row.season !== 2026 ||
            record.row.competition !== "regular"
          )
            unavailable();
        for (const role of ["batter", "starter", "reliever"])
          for (const window of [3, 5, 10, 20]) {
            const home = release.homes[`${role}/${window}`];
            if (
              !home ||
              home.asOf !== release.asOf ||
              home.source !== release.fixture.sourceId
            )
              unavailable();
          }
      }
    } else if (context?.requested && context.requested !== baselineReleaseId())
      unavailable();
  } catch {
    unavailable();
  }
  if (context) {
    context.loaded = true;
    context.release = release;
  }
  return release;
}
export function assertCanonicalPublication(filename = publicationPath()): void {
  selectedPublication(filename);
}
export function baselineSelected() {
  return selection.getStore()?.requested === baselineReleaseId();
}
export function publicationIdentity() {
  const r = selectedPublication();
  return r
    ? { releaseId: r.releaseId, revision: r.revision, asOf: r.asOf }
    : {
        releaseId: baselineReleaseId(),
        revision: 0,
        asOf: "2026-11-03T00:00:00.000Z",
      };
}
