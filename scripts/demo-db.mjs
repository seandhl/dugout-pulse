import { prepareSnapshots } from "./demo-snapshots.mjs";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { generate } from "../src/demo/generator.ts";
import { generatePerformance } from "../src/demo/performance.ts";
import { createHash } from "node:crypto";
if (
  process.env.DEMO_PROFILE &&
  !["default", "performance"].includes(process.env.DEMO_PROFILE)
)
  throw Error("Unknown DEMO_PROFILE");
mkdirSync(".demo", { recursive: true });
const db = new DatabaseSync(".demo/fixture.sqlite");
try {
  db.exec(
    "CREATE TABLE IF NOT EXISTS demo_release (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, hash TEXT NOT NULL)",
  );
  if (process.argv[2] === "reset") {
    db.exec("DELETE FROM demo_release");
    console.log("DEMO SQLite reset (PostgreSQL untouched)");
  } else if (process.argv[2] === "seed") {
    const payload = JSON.stringify(
      process.env.DEMO_PROFILE === "performance"
        ? generatePerformance()
        : generate(),
    );
    const hash = createHash("sha256").update(payload).digest("hex");
    const fixture = JSON.parse(payload);
    const jobStart = performance.now();
    const snapshots = await prepareSnapshots(fixture);
    const jobDurationMs = performance.now() - jobStart;
    db.exec(
      "CREATE TABLE IF NOT EXISTS demo_home_snapshot (release_id TEXT NOT NULL, role TEXT NOT NULL, window INTEGER NOT NULL, payload TEXT NOT NULL, release_hash TEXT NOT NULL, PRIMARY KEY(release_id, role, window)); BEGIN IMMEDIATE",
    );
    if (
      !db
        .prepare("PRAGMA table_info(demo_home_snapshot)")
        .all()
        .some((column) => column.name === "release_hash")
    )
      db.exec(
        "ALTER TABLE demo_home_snapshot ADD COLUMN release_hash TEXT NOT NULL DEFAULT ''",
      );
    db.exec("DELETE FROM demo_home_snapshot");
    const insert = db.prepare(
      "INSERT INTO demo_home_snapshot VALUES (?, ?, ?, ?, ?)",
    );
    for (const snapshot of snapshots)
      insert.run(
        fixture.releaseId,
        snapshot.role,
        snapshot.window,
        snapshot.payload,
        hash,
      );
    db.prepare(
      "INSERT INTO demo_release VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, hash=excluded.hash",
    ).run(payload, hash);
    db.exec("PRAGMA user_version=1; COMMIT");
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir("reports", { recursive: true });
    await writeFile(
      `reports/seed-${process.env.DEMO_PROFILE || "default"}.json`,
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          mode: "DEMO",
          hash,
          players: fixture.players.length,
          snapshots: snapshots.length,
          jobDurationMs,
          rssBytes: process.memoryUsage().rss,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`DEMO seed ${hash}`);
  } else throw new Error("Use reset or seed");
} finally {
  db.close();
}
