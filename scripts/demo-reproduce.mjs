// Run against a local dev server. Mutates only the disposable DEMO SQLite DB.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3100";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const run = (command) =>
  execFileSync(process.execPath, ["scripts/demo-db.mjs", command], {
    stdio: "pipe",
  });
async function snapshot() {
  const players = [];
  let cursor;
  do {
    const url = new URL("/api/v1/players", base);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.meta.demo, true);
    players.push(...body.data);
    cursor = body.pagination.nextCursor;
  } while (cursor);
  assert.equal(players.length, 150);
  assert.equal(new Set(players.map((p) => p.playerId)).size, 150);
  const details = await Promise.all(
    players.map(async (p) => {
      const response = await fetch(`${base}/api/v1/players/${p.playerId}`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.data, p);
      return body;
    }),
  );
  return details;
}
for (let iteration = 0; iteration < 2; iteration++) {
  run("reset");
  const empty = await fetch(`${base}/api/v1/players`);
  assert.equal(empty.status, 503);
  assert.equal((await empty.json()).error.code, "DATA_UNAVAILABLE");
  run("seed");
  const data = await snapshot();
  if (iteration === 0) globalThis.first = data;
  else assert.deepEqual(data, globalThis.first);
}
console.log(
  "PASS: reset -> 503 -> seed -> 150 list/detail responses, identical across two cycles",
);
