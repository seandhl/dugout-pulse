import { chromium } from "@playwright/test";
import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
const baseURL = process.env.PERFORMANCE_BASE_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  // All measurements work without headshots, logos, or any external media.
  await context.route("**/*", (route) =>
    route.request().resourceType() === "image"
      ? route.abort()
      : route.continue(),
  );
  const firstStart = performance.now();
  const firstResponse = await context.request.get(
    `${baseURL}/api/v1/player-directory`,
  );
  const firstBody = await firstResponse.json();
  if (!firstResponse.ok() || firstBody.players.length > 20)
    throw Error("First API failed");
  const firstApi = {
    durationMs: performance.now() - firstStart,
    players: firstBody.total,
    note: "First request in script; cold only when started against a fresh process",
  };
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__perf = { lcp: null, cls: 0, interactions: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.interactionId) window.__perf.interactions.push(e.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const navigationStart = performance.now();
    await page.goto(`${baseURL}/players`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /선수/ }).first().waitFor();
    await page.getByRole("list", { name: "선수 검색 결과" }).waitFor();
    if (await page.locator("main section[role=alert]").count())
      throw Error("Directory rendered an error");
    const directoryReadyMs = performance.now() - navigationStart;
    const input = page.getByRole("searchbox").first();
    await input.fill("가상 A");
    await page.waitForURL(/q=/);
    await page.getByRole("list", { name: "선수 검색 결과" }).waitFor();
    await page.waitForTimeout(200);
    await page.mouse.click(1, 1);
    const row = await page.evaluate(() => ({
      ...window.__perf,
      resources: performance
        .getEntriesByType("resource")
        .filter((e) => e.initiatorType === "script")
        .map((e) => ({
          name: new URL(e.name).pathname,
          encodedBodySize: e.encodedBodySize,
          transferSize: e.transferSize,
        })),
    }));
    rows.push({ ...row, directoryReadyMs });
  }
  const api = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const response = await context.request.get(
      `${baseURL}/api/v1/player-directory?q=${encodeURIComponent(i % 2 ? "가상 A" : "가상")}`,
    );
    const body = await response.json();
    if (!response.ok())
      throw Error(`API ${response.status()} ${JSON.stringify(body)}`);
    api.push(performance.now() - start);
  }
  api.sort((a, b) => a - b);
  const ids = new Set();
  let cursor;
  let pages = 0;
  do {
    const url = new URL("/api/v1/players", baseURL);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await context.request.get(url.toString());
    if (!response.ok()) throw Error(`Cursor API ${response.status()}`);
    const body = await response.json();
    if (body.data.length > 20) throw Error("Unbounded player page");
    for (const player of body.data) {
      if (ids.has(player.playerId)) throw Error("Duplicate cursor row");
      ids.add(player.playerId);
    }
    cursor = body.pagination.nextCursor;
    pages++;
    if (pages > 1000) throw Error("Non-terminating cursor");
  } while (cursor);
  async function chunks(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...(await chunks(file)));
      else if (entry.name.endsWith(".js")) {
        const bytes = await readFile(file);
        result.push({
          path: file,
          bytes: bytes.length,
          gzipBytes: gzipSync(bytes).length,
        });
      }
    }
    return result;
  }
  const report = {
    measuredAt: new Date().toISOString(),
    baseURL,
    buildMode: process.env.PERFORMANCE_BUILD_MODE ?? "unspecified",
    note: "Local laboratory, images blocked, unthrottled desktop. Interaction duration is a lab proxy, not field INP. CLS is total shifts in the observation interval, not field session-window CLS.",
    rows,
    firstApi,
    cursorScan: { players: ids.size, pages, duplicateIds: 0 },
    api: { samples: api.length, medianMs: api[15], p95Ms: api[28] },
    chunks: await chunks(`${process.env.PERFORMANCE_DIST ?? ".next"}/static`),
  };
  await mkdir("reports", { recursive: true });
  await writeFile(
    `reports/performance-browser${process.env.PERFORMANCE_LABEL ? `-${process.env.PERFORMANCE_LABEL}` : ""}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  if (report.api.p95Ms >= 200) throw Error("HTTP p95 target exceeded");
  if (rows.some((row) => row.lcp === null || row.lcp > 2500 || row.cls > 0.1))
    throw Error("Lab visual performance target exceeded");
  console.log(
    JSON.stringify({
      lcp: rows.map((r) => r.lcp),
      cls: rows.map((r) => r.cls),
      api: report.api,
    }),
  );
} finally {
  await browser.close();
}
