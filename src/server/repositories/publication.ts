import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ApiError } from "../http/errors";

const legacyState = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  records: z.record(z.string(), z.unknown()),
});

/** Fail closed until a complete cross-store projection can be selected atomically.
 * Never cache this check: a cached fixture must not bypass a later publication.
 * Atomic pipeline rename means a reader observes either complete file version.
 */
export function assertCanonicalPublication(
  filename = resolve(
    process.cwd(),
    ".demo",
    process.env.INGEST_E2E === "1" ? "pipeline-e2e" : "pipeline",
    "state.json",
  ),
): void {
  try {
    const state = legacyState.parse(JSON.parse(readFileSync(filename, "utf8")));
    if (state.revision !== 0 || Object.keys(state.records).length !== 0)
      throw new Error("Unlinked publication");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new ApiError(
      "STALE_DATA",
      503,
      "게시 릴리스 연결 대기 중입니다. 서로 다른 수정본의 공개 조회를 차단했습니다.",
    );
  }
}
