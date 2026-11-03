import { issueSession, sessionCookie } from "../../src/server/ingest/admin";
import { afterEach, describe, expect, it } from "vitest";
import { readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  checksum,
  FileError,
  kst,
  makeReport,
  MAX_BYTES,
  parseFile,
  rowKey,
  validateRows,
  type Context,
  type Kind,
} from "../../src/server/ingest/files";
import { stage } from "../../src/server/ingest/service";
import { POST } from "../../src/app/api/admin/ingest/route";
import { GET } from "../../src/app/api/admin/ingest/templates/route";
const context: Context = {
  identities: new Map([
    ["demo_ext_1", "demo_player_1"],
    ["demo_ext_2", "demo_player_2"],
  ]),
  games: new Set(["demo_game_1"]),
  existing: new Map(),
};
const kinds: Kind[] = [
  "players",
  "games",
  "batting_game_logs",
  "pitching_game_logs",
  "rosters",
];
async function sample(kind: Kind, format = "json") {
  return readFile(`fixtures/ingest/${kind}.${format}`);
}
async function rows(kind: Kind) {
  return parseFile(await sample(kind), `${kind}.json`) as Record<
    string,
    unknown
  >[];
}
const original = process.env.INGEST_ADMIN_TOKEN_SHA256;
const token = "test-only-admin-capability-0123456789";
const batches: string[] = [];
afterEach(async () => {
  if (original === undefined) delete process.env.INGEST_ADMIN_TOKEN_SHA256;
  else process.env.INGEST_ADMIN_TOKEN_SHA256 = original;
  for (const id of batches.splice(0))
    await rm(`.demo/ingest/${id}.json`, { force: true });
});
function authorize() {
  process.env.ADMIN_ORIGIN = "http://localhost";
  process.env.ADMIN_ACTOR_ID = "unit-operator";
  process.env.ADMIN_SESSION_SECRET = "s".repeat(64);
  process.env.INGEST_ADMIN_TOKEN_SHA256 = createHash("sha256")
    .update(token)
    .digest("hex");
}
function request(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/ingest", {
    method: "POST",
    headers: {
      cookie: `${sessionCookie}=${process.env.ADMIN_SESSION_SECRET ? issueSession() : ""}`,
      origin: "http://localhost",
      "content-type": "application/json",
      "x-file-name": "players.json",
      "x-ingest-kind": "players",
      ...headers,
    },
    body,
  });
}
describe("safe sample ingest", () => {
  it.each(kinds)(
    "validates %s in CSV and JSON with matching normalization",
    async (kind) => {
      const json = validateRows(kind, await rows(kind), context);
      const csv = validateRows(
        kind,
        parseFile(await sample(kind, "csv"), `${kind}.csv`),
        context,
      );
      expect(json.counts.errors).toBe(0);
      expect(json.counts.new).toBeGreaterThan(0);
      expect(csv.accepted).toEqual(json.accepted);
    },
  );
  it("preserves namesakes using external IDs, never names", async () => {
    const result = validateRows("players", await rows("players"), context);
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted[0].player_id).not.toBe(result.accepted[1].player_id);
  });
  it("reports missing fields and conflicting identity", async () => {
    const list = await rows("players");
    delete list[0].role;
    expect(validateRows("players", list, context).counts.errors).toBe(1);
    expect(
      validateRows(
        "players",
        [{ ...list[1], external_player_id: "demo_ext_1" }],
        context,
      ).counts.errors,
    ).toBe(1);
  });
  it("distinguishes duplicates, updates and conflicting duplicates", async () => {
    const [row] = await rows("players");
    const first = validateRows("players", [row], context).accepted[0];
    const existing = new Map([[rowKey("players", first), first]]);
    expect(validateRows("players", [row, row], context).counts.duplicates).toBe(
      1,
    );
    expect(
      validateRows("players", [row], { ...context, existing }).counts
        .duplicates,
    ).toBe(1);
    expect(
      validateRows("players", [{ ...row, display_name: "DEMO 변경" }], {
        ...context,
        existing,
      }).counts.updates,
    ).toBe(1);
    expect(
      validateRows("players", [row, { ...row, role: "STARTER" }], context)
        .counts.errors,
    ).toBe(1);
  });
  it("blocks missing player/game references and invalid enums", async () => {
    const [row] = await rows("batting_game_logs");
    expect(
      validateRows(
        "batting_game_logs",
        [{ ...row, external_player_id: "demo_missing" }],
        context,
      ).counts.errors,
    ).toBe(1);
    expect(
      validateRows(
        "batting_game_logs",
        [{ ...row, game_id: "demo_missing" }],
        context,
      ).counts.errors,
    ).toBe(1);
    const [roster] = await rows("rosters");
    expect(
      validateRows("rosters", [{ ...roster, status: "ACTIVE" }], context).counts
        .errors,
    ).toBe(1);
  });
  it("rejects incomplete innings, converts baseball outs, warns outliers", async () => {
    const [row] = await rows("pitching_game_logs");
    expect(
      validateRows("pitching_game_logs", [row], context).accepted[0].outs,
    ).toBe(20);
    for (const innings of ["6", "6.3", "6.5", "6.33", 6.2])
      expect(
        validateRows("pitching_game_logs", [{ ...row, innings }], context)
          .counts.errors,
      ).toBe(1);
    expect(
      validateRows("pitching_game_logs", [{ ...row, innings: "15.0" }], context)
        .counts.warnings,
    ).toBe(1);
  });
  it("parses UTF-8/BOM, escaped CSV, aliases and KST", async () => {
    const bytes = await sample("players", "csv");
    expect(
      parseFile(
        Buffer.concat([Buffer.from([239, 187, 191]), bytes]),
        "players.csv",
      ),
    ).toHaveLength(2);
    expect(
      parseFile(
        Buffer.from('선수명,선수ID\r\n"DEMO A,""B""",demo_p\r\n'),
        "players.csv",
      ),
    ).toEqual([{ display_name: 'DEMO A,"B"', player_id: "demo_p" }]);
    expect(kst.parse("2026-10-31T18:00:00")).toBe("2026-10-31T09:00:00.000Z");
    expect(() =>
      parseFile(Buffer.from("선수명,display_name\na,b"), "p.csv"),
    ).toThrow("매핑 충돌");
  });
  it("rejects encoding, oversize, paths, malformed CSV, empty and non-array", () => {
    for (const [bytes, name] of [
      [Buffer.from([0xff]), "p.csv"],
      [Buffer.alloc(MAX_BYTES + 1), "p.csv"],
      [Buffer.from("[]"), "../p.json"],
      [Buffer.from('a\n"unfinished'), "p.csv"],
      [Buffer.from("{}"), "p.json"],
      [Buffer.from("[]"), "p.json"],
    ] as const)
      expect(() => parseFile(bytes, name)).toThrow(FileError);
  });
  it("rejects formula injection and prevents publishing partial batches", async () => {
    const [row] = await rows("players");
    for (const name of ["=cmd()", " +SUM(A1)", "@cmd", "-cmd"])
      expect(
        validateRows("players", [{ ...row, display_name: name }], context)
          .issues[0].code,
      ).toBe("FORMULA_CELL");
    const report = makeReport(
      "players",
      Buffer.from("test"),
      [row, { ...row, role: "NO" }],
      context,
    );
    expect(report.status).toBe("REJECTED");
    expect(report.published).toBe(false);
    expect(report.publishAllowed).toBe(false);
  });
  it("denies unauthorized requests before reading their body", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const req = request("not JSON");
    const result = await POST(req);
    expect(result.status).toBe(403);
    expect(req.bodyUsed).toBe(false);
    authorize();
    expect((await POST(request("[]", { cookie: "invalid" }))).status).toBe(403);
    expect(
      (await POST(request("[]", { origin: "https://evil.example" }))).status,
    ).toBe(403);
  });
  it("enforces streaming limit even without content-length", async () => {
    authorize();
    expect((await POST(request(" ".repeat(MAX_BYTES + 1)))).status).toBe(413);
  });
  it("downloads, uploads and persists a private report without public mutation", async () => {
    authorize();
    const download = await GET(
      new Request(
        "http://localhost/api/admin/ingest/templates?kind=players&format=json",
        { headers: { cookie: `${sessionCookie}=${issueSession()}` } },
      ),
    );
    expect(download.status).toBe(200);
    const bytes = Buffer.from(await download.arrayBuffer());
    const response = await POST(request(bytes));
    expect(response.status).toBe(200);
    const report = await response.json();
    batches.push(report.importBatchId);
    expect(report.counts.new).toBe(2);
    expect(report.checksum).toBe(checksum(bytes));
    expect(report.published).toBe(false);
    expect(report.accepted).toBeUndefined();
    const stored = JSON.parse(
      await readFile(`.demo/ingest/${report.importBatchId}.json`, "utf8"),
    );
    expect(stored.accepted).toHaveLength(2);
    expect(stored.sourceId).toBe("demo-file-source");
    expect(stored.licenseId).toBe("demo-self-authored-v1");
    expect(stored.schemaVersion).toBe("1.0.0");
    expect(
      (await readdir(".demo/ingest")).includes(`${report.importBatchId}.json`),
    ).toBe(true);
  });
  it("denies edited files and path-based templates", async () => {
    authorize();
    expect(
      (await POST(request(JSON.stringify(await rows("players"))))).status,
    ).toBe(422);
    expect(
      (
        await GET(
          new Request(
            "http://localhost/api/admin/ingest/templates?kind=../../etc/passwd",
            { headers: { cookie: `${sessionCookie}=${issueSession()}` } },
          ),
        )
      ).status,
    ).toBe(400);
    await expect(
      stage(request("[]", { "content-type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
  });
});
it("stages defective samples as rejected and reports duplicates", async () => {
  authorize();
  for (const variant of ["errors", "duplicates"]) {
    const bytes = await readFile(`fixtures/ingest/players-${variant}.json`);
    const response = await POST(request(bytes));
    expect(response.status).toBe(200);
    const report = await response.json();
    batches.push(report.importBatchId);
    expect(report.published).toBe(false);
    expect(report.publishAllowed).toBe(false);
    if (variant === "errors") {
      expect(report.status).toBe("REJECTED");
      expect(report.counts.errors).toBe(1);
    } else expect(report.counts.duplicates).toBe(1);
  }
  expect(() => kst.parse("2026-02-30T12:00:00")).toThrow();
  expect(() => kst.parse("2026-10-31T24:00:00")).toThrow();
});
it("validates the actual Host rather than Next internal localhost URL", async () => {
  authorize();
  process.env.ADMIN_ORIGIN = "http://127.0.0.1:3101";
  const bytes = await sample("players");
  const response = await POST(
    request(bytes, { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" }),
  );
  expect(response.status).toBe(200);
  const report = await response.json();
  batches.push(report.importBatchId);
  expect(
    (
      await POST(
        request(bytes, {
          host: "127.0.0.1:3101",
          origin: "http://evil.example",
          "x-forwarded-host": "evil.example",
        }),
      )
    ).status,
  ).toBe(403);
});
