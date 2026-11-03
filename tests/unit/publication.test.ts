import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertCanonicalPublication } from "../../src/server/repositories/publication";
import { createPipeline } from "../../src/server/ingest/pipeline";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "pulse-release-"));
  directories.push(directory);
  const guard = () => assertCanonicalPublication(join(directory, "state.json"));
  return {
    directory,
    guard,
    pipeline: createPipeline(directory, undefined, guard),
  };
}
it("keeps canonical reads available for staging and failed validation, blocks all public file reads after publication/correction/rollback", async () => {
  const { guard, pipeline } = await setup();
  expect(guard).not.toThrow();
  const rows = JSON.parse(
    await readFile("fixtures/ingest/players.json", "utf8"),
  );
  const stage = (input: unknown[]) =>
    pipeline.stage("players", Buffer.from(JSON.stringify(input)), input);
  const invalid = await stage([{ ...rows[0], season: 1900 }]);
  expect((await pipeline.publish(invalid.importBatchId)).published).toBe(false);
  expect(guard).not.toThrow();
  const batch = await stage(rows);
  expect(guard).not.toThrow();
  expect((await pipeline.publish(batch.importBatchId)).published).toBe(true);
  const blocked = async () => {
    expect(guard).toThrow("게시 릴리스 연결 대기");
    await expect(pipeline.readPublicState()).rejects.toMatchObject({
      status: 503,
      code: "STALE_DATA",
    });
    await expect(pipeline.publicResults(2026, "regular")).rejects.toMatchObject(
      { status: 503 },
    );
    await expect(
      pipeline.scope({
        season: 2026,
        competition: "regular",
        date: "2026-10-31",
        search: "appeared",
        q: "",
      }),
    ).rejects.toMatchObject({ status: 503 });
  };
  await blocked();
  const correction = await stage(
    rows.map((row: Record<string, unknown>) => ({
      ...row,
      display_name: "DEMO 정정",
      as_of: "2026-11-02T21:00:00",
    })),
  );
  expect((await pipeline.publish(correction.importBatchId)).published).toBe(
    true,
  );
  await blocked();
  await pipeline.rollback(correction.importBatchId);
  await blocked();
  // Admin history stays readable; public reads never fall back to another store.
  expect((await pipeline.read()).revision).toBe(3);
});
it("does not treat malformed or unsupported state as an empty publication", async () => {
  const { directory, guard } = await setup();
  for (const content of [
    "{",
    JSON.stringify({ version: 2, revision: 0, records: {} }),
    JSON.stringify({ version: 1, revision: 0, records: { unexpected: {} } }),
  ]) {
    await writeFile(join(directory, "state.json"), content);
    expect(guard).toThrow("게시 릴리스 연결 대기");
  }
});
