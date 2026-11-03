import { expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { generate } from "../../src/demo/generator";
import { readDemo } from "../../src/server/db/demo";
import {
  createMomentumBatchScorer,
  scoreMomentum,
} from "../../src/stats/momentum";
import { momentumScenario } from "../../fixtures/stats/momentum-input";
it("validates schema and reads a release once and invalidates on SQLite publication/tampering", () => {
  const temp = mkdtempSync(join(tmpdir(), "dugout-cache-"));
  mkdirSync(join(temp, ".demo"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(temp);
  vi.stubEnv("DEMO_PROFILE", "default");
  const db = new DatabaseSync(join(temp, ".demo/fixture.sqlite"));
  const payload = JSON.stringify(generate());
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  db.exec(
    "PRAGMA user_version=1; CREATE TABLE demo_release (id INTEGER PRIMARY KEY, payload TEXT, hash TEXT)",
  );
  db.prepare("INSERT INTO demo_release VALUES (1, ?, ?)").run(
    payload,
    hash(payload),
  );
  const prepare = vi.spyOn(DatabaseSync.prototype, "prepare");
  try {
    const first = readDemo();
    expect(readDemo()).toBe(first);
    expect(prepare).toHaveBeenCalledTimes(2); // schema + release; cached metadata/list add no queries.
    db.prepare("UPDATE demo_release SET payload=?, hash=?").run(
      "{}",
      hash("{}"),
    );
    expect(() => readDemo()).toThrow("DEMO DB");
    db.prepare("UPDATE demo_release SET payload=?, hash=?").run(
      payload,
      hash(payload),
    );
    expect(readDemo()).toEqual(first);
    expect(readDemo()).not.toBe(first);
    db.exec("PRAGMA user_version=2");
    expect(() => readDemo()).toThrow("DEMO DB");
    db.exec("PRAGMA user_version=1");
    expect(readDemo()).toEqual(first);
    vi.stubEnv("PUBLICATION_STATE", "maintenance");
    expect(() => readDemo()).toThrow("DEMO DB");
    vi.stubEnv("PUBLICATION_STATE", "demo");
    vi.stubEnv("DATA_MODE", "APPROVED");
    expect(() => readDemo()).toThrow("DEMO DB");
  } finally {
    prepare.mockRestore();
    db.close();
    cwd.mockRestore();
    vi.unstubAllEnvs();
    rmSync(temp, { recursive: true, force: true });
  }
});
it("batch scoring matches full validation, owns its rows and keeps trace hashes by default", () => {
  const input = momentumScenario("hitter", "up");
  const batch = createMomentumBatchScorer(input.rows);
  const { rows: _rows, ...metadata } = input;
  void _rows;
  const expected = structuredClone(scoreMomentum(input));
  expect(batch(metadata)).toEqual(expected);
  expect(batch(metadata)).toEqual(expected);
  input.rows[0].counts.h = 999;
  expect(batch(metadata)).toEqual(expected);
  const compact = batch(metadata, { includeInputHash: false });
  expect(compact.rawScore).toBe(expected.rawScore);
  expect(compact.confidence).toBe(expected.confidence);
  expect(batch({ ...metadata, cutoffAt: "bad" }).status).toBe("invalid_input");
});
it("invalidates public state on source/license changes and retries a transient job lock", async () => {
  const { createPipeline, demoRights } = await import(
    "../../src/server/ingest/pipeline"
  );
  const { writeFile, mkdir, rm } = await import("node:fs/promises");
  const temp = mkdtempSync(join(tmpdir(), "dugout-public-cache-"));
  const rights = { ...demoRights, displayAllowed: true };
  const p = createPipeline(temp, rights);
  const state = {
    version: 1,
    revision: 0,
    records: {},
    batches: {},
    history: [],
    audit: [],
    events: [],
    aggregates: {},
    scores: {},
  };
  try {
    await writeFile(join(temp, "state.json"), JSON.stringify(state));
    const first = await p.readPublicState();
    expect(await p.readPublicState()).toBe(first);
    rights.displayAllowed = false;
    await expect(p.readPublicState()).rejects.toThrow("licenseId");
    rights.displayAllowed = true;
    await writeFile(
      join(temp, "state.json"),
      JSON.stringify({ ...state, revision: 2 }),
    );
    expect((await p.readPublicState()).revision).toBe(2);
    await mkdir(join(temp, "lock"));
    const release = setTimeout(
      () => void rm(join(temp, "lock"), { recursive: true }),
      35,
    );
    try {
      await p.recalculateMomentum();
    } finally {
      clearTimeout(release);
    }
    expect(await p.readPublicState()).not.toBe(first);
    await Promise.all([p.recalculateMomentum(), p.recalculateMomentum()]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
