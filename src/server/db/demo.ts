import "server-only";
import {
  assertCanonicalPublication,
  selectedPublication,
} from "../repositories/publication";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { generatePerformance } from "../../demo/performance";
import { resolve } from "node:path";
import { generate, type Fixture } from "../../demo/generator";
import { ApiError } from "../http/errors";
let cached: { signature: string; fixture: Fixture; hash: string } | undefined;
let canonical: string | undefined;
let canonicalProfile: string | undefined;
export function readDemo(): Fixture {
  assertCanonicalPublication();
  const release = selectedPublication();
  if (release) {
    if (
      (process.env.DATA_MODE && process.env.DATA_MODE !== "DEMO") ||
      (process.env.PUBLICATION_STATE &&
        process.env.PUBLICATION_STATE !== "demo")
    )
      throw new ApiError(
        "DATA_UNAVAILABLE",
        503,
        "DEMO 공개가 중단되었습니다.",
      );
    return release.fixture;
  }
  try {
    if (
      process.env.PUBLICATION_STATE &&
      process.env.PUBLICATION_STATE !== "demo"
    )
      throw new Error("Publication suspended");
    if (process.env.DATA_MODE && process.env.DATA_MODE !== "DEMO")
      throw new Error("Non-demo mode denied");
    const filename = resolve(process.cwd(), ".demo/fixture.sqlite");
    const stat = statSync(filename, { bigint: true });
    const profile = process.env.DEMO_PROFILE || "default";
    if (!["default", "performance"].includes(profile))
      throw new Error("Unknown DEMO profile");
    const signature = `${profile}/${stat.ino}/${stat.size}/${stat.mtimeNs}/${stat.ctimeNs}`;
    if (cached?.signature === signature) return cached.fixture;
    const db = new DatabaseSync(
      resolve(process.cwd(), ".demo/fixture.sqlite"),
      { readOnly: true },
    );
    try {
      if (db.prepare("PRAGMA user_version").get()?.user_version !== 1)
        throw new Error("Schema mismatch");
      const row = db
        .prepare("SELECT payload, hash FROM demo_release WHERE id=1")
        .get();
      if (
        !row ||
        typeof row.payload !== "string" ||
        createHash("sha256").update(row.payload).digest("hex") !== row.hash
      )
        throw new Error("Invalid release");
      const fixture: Fixture = JSON.parse(row.payload);
      // Only the canonical synthetic release is accepted in this DEMO store.
      if (!canonical || canonicalProfile !== profile) {
        canonical = JSON.stringify(
          profile === "performance" ? generatePerformance() : generate(),
        );
        canonicalProfile = profile;
      }
      if (row.payload !== canonical) throw new Error("Unknown release");
      cached = { signature, fixture, hash: String(row.hash) };
      return fixture;
    } finally {
      db.close();
    }
  } catch {
    cached = undefined;
    throw new ApiError(
      "DATA_UNAVAILABLE",
      503,
      "DEMO DB가 비어 있습니다. pnpm db:seed를 실행해 주세요.",
    );
  }
}

export function verifiedDemoHash(fixture: Fixture): string {
  if (cached?.fixture !== fixture) throw new Error("Unverified fixture");
  return cached.hash;
}
