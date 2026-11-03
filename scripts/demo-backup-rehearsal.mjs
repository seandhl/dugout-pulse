import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const directory = mkdtempSync(join(tmpdir(), "dugout-restore-"));
const backup = join(directory, "backup.sqlite");
const source = new DatabaseSync(".demo/fixture.sqlite", { readOnly: true });
try {
  // VACUUM INTO gives a consistent SQLite backup, even with WAL enabled.
  source.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  const restored = new DatabaseSync(backup, { readOnly: true });
  try {
    assert.equal(
      restored.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    assert.equal(restored.prepare("PRAGMA user_version").get().user_version, 1);
    const row = restored
      .prepare("SELECT payload, hash FROM demo_release WHERE id=1")
      .get();
    assert.equal(
      createHash("sha256").update(row.payload).digest("hex"),
      row.hash,
    );
    assert.equal(
      row.hash,
      source.prepare("SELECT hash FROM demo_release WHERE id=1").get().hash,
    );
    assert.equal(
      restored.prepare("SELECT count(*) AS n FROM demo_home_snapshot").get().n,
      12,
    );
    console.log(
      "PASS: isolated SQLite backup/restore integrity, schema, hash, 12 snapshots",
    );
  } finally {
    restored.close();
  }
} finally {
  source.close();
  rmSync(directory, { recursive: true, force: true });
}
