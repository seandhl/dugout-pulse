import { afterEach, expect, it, vi } from "vitest";
import {
  issueSession,
  assertAdmin,
  sessionCookie,
} from "../../src/server/ingest/admin";
import { POST as upload } from "../../src/app/api/admin/ingest/route";
import { POST as publish } from "../../src/app/api/admin/ingest/publish/route";
import { POST as rollback } from "../../src/app/api/admin/ingest/rollback/route";
import { GET as status } from "../../src/app/api/admin/ingest/status/route";
import { GET as templates } from "../../src/app/api/admin/ingest/templates/route";
import { createPipeline, demoRights } from "../../src/server/ingest/pipeline";
function setup() {
  vi.stubEnv("ADMIN_ORIGIN", "https://private.example");
  vi.stubEnv("ADMIN_ACTOR_ID", "operator-security-test");
  vi.stubEnv("ADMIN_SESSION_SECRET", "x".repeat(64));
}
function request(cookie = "", body = "{}", origin = "https://private.example") {
  return new Request("https://private.example/api/admin/ingest", {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body,
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("all private route handlers deny PUBLIC direct calls before body parsing", async () => {
  setup();
  for (const handler of [upload, publish, rollback, status, templates]) {
    const req = request();
    expect((await handler(req)).status).toBe(403);
    expect(req.bodyUsed).toBe(false);
  }
});
it("rejects forged, expired and cross-origin sessions and bearer bypass", () => {
  setup();
  const cookie = `${sessionCookie}=${issueSession()}`;
  expect(assertAdmin(request(cookie)).role).toBe("ADMIN");
  expect(() => assertAdmin(request(cookie + "x"))).toThrow();
  expect(() =>
    assertAdmin(request(cookie, "{}", "https://evil.example")),
  ).toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 16 * 60_000);
  expect(() => assertAdmin(request(cookie))).toThrow();
});
it("rejects publish without all five explicit approvals", async () => {
  setup();
  const result = await publish(
    request(
      `${sessionCookie}=${issueSession()}`,
      JSON.stringify({
        batchId: "11111111-1111-4111-8111-111111111111",
        approve: true,
      }),
    ),
  );
  expect(result.status).toBe(400);
});
it.each(["EXPIRED", "REJECTED"])(
  "fails closed for %s source rights",
  async (status) => {
    const pipeline = createPipeline("/tmp/dugout-denied-rights", {
      ...demoRights,
      status,
    });
    await expect(pipeline.publish("unknown")).rejects.toMatchObject({
      status: 403,
    });
  },
);
it("rollback restores records and refuses repeated rollback", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { parseFile } = await import("../../src/server/ingest/files");
  const dir = await mkdtemp(join(tmpdir(), "dugout-rollback-"));
  try {
    const p = createPipeline(dir);
    const bytes = await readFile("fixtures/ingest/players.json");
    const report = await p.stage(
      "players",
      bytes,
      parseFile(bytes, "players.json"),
    );
    expect((await p.publish(report.importBatchId)).published).toBe(true);
    expect(Object.keys((await p.read()).records).length).toBe(2);
    await p.rollback(report.importBatchId);
    expect((await p.read()).records).toEqual({});
    await expect(p.rollback(report.importBatchId)).rejects.toMatchObject({
      status: 409,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("requires configured token hash and rejects wrong, short or non-ASCII capabilities", async () => {
  const { createHash } = await import("node:crypto");
  const { verifyToken } = await import("../../src/server/ingest/admin");
  const token = "fixture-only-capability-" + "a".repeat(32);
  vi.stubEnv("INGEST_ADMIN_TOKEN_SHA256", "");
  expect(verifyToken(token)).toBe(false);
  vi.stubEnv(
    "INGEST_ADMIN_TOKEN_SHA256",
    createHash("sha256").update(token).digest("hex"),
  );
  expect(verifyToken(token)).toBe(true);
  for (const invalid of ["short", token + "x", "가".repeat(64), " ".repeat(64)])
    expect(verifyToken(invalid)).toBe(false);
});
