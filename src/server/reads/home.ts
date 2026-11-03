import "server-only";
import { selectedPublication } from "../repositories/publication";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { readDemo, verifiedDemoHash } from "../db/demo";
import { ApiError } from "../http/errors";
import type { Fixture } from "../../demo/generator";
import type { z } from "zod";
import { homeResponse, type homeQuery } from "../../contracts/home";
const snapshots = new WeakMap<
  Fixture,
  Map<string, z.infer<typeof homeResponse>>
>();
export function readHome(query: z.infer<typeof homeQuery>) {
  const f = readDemo();
  const release = selectedPublication();
  if (release) return release.homes[`${query.role}/${query.window}`];
  let cache = snapshots.get(f);
  if (!cache) snapshots.set(f, (cache = new Map()));
  const key = `${query.role}/${query.window}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const db = new DatabaseSync(resolve(process.cwd(), ".demo/fixture.sqlite"), {
    readOnly: true,
  });
  try {
    const row = db
      .prepare(
        "SELECT payload FROM demo_home_snapshot WHERE release_id=? AND role=? AND window=? AND release_hash=?",
      )
      .get(f.releaseId, query.role, Number(query.window), verifiedDemoHash(f));
    if (!row || typeof row.payload !== "string")
      throw new Error("Snapshot missing");
    const result = homeResponse.parse(JSON.parse(row.payload));
    if (result.source !== f.sourceId || result.asOf !== f.asOf)
      throw new Error("Stale snapshot");
    cache.set(key, result);
    return result;
  } catch {
    throw new ApiError(
      "DATA_UNAVAILABLE",
      503,
      "DEMO 사전 계산이 필요합니다. pnpm db:seed를 실행해 주세요.",
    );
  } finally {
    db.close();
  }
}
