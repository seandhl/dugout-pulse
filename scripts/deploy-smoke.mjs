import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3200";
const maintenance = process.env.SMOKE_MAINTENANCE === "1";
const get = async (path) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
assert.equal((await get("/api/health")).status, 200);
const ready = await get("/api/ready");
assert.equal(ready.status, maintenance ? 503 : 200);
if (!maintenance) {
  const status = await ready.json();
  assert.equal(status.mode, "DEMO");
  assert.equal(status.importStatus, "canonical_fixture_verified");
  const response = await get("/api/v1/players");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meta.demo, true);
  assert.ok(body.data.length > 0);
  assert.equal(body.meta.sourceMode, "DEMO");
  assert.ok(body.data.every((p) => p.playerId.startsWith("demo_")));
}
assert.equal((await get("/")).status, maintenance ? 503 : 200);
assert.equal((await get("/api/admin/ingest/status")).status, 403);
for (const path of ["/legal", "/privacy", "/data-terms", "/about"]) {
  const response = await get(path);
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("DEMO"));
}
if (maintenance) assert.equal((await get("/api/v1/players")).status, 503);
console.log(`PASS: production DEMO smoke (maintenance=${maintenance})`);
