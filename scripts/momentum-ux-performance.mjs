import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.PERFORMANCE_BASE_URL ?? "http://127.0.0.1:3198";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
  throw new Error("Local DEMO server required");
const browser = await chromium.launch();
const results = [];
try {
  for (const [path, ready] of [
    ["/", "[data-testid=home-rankings] a"],
    ["/players/demo_0_00?window=20", ".game-analysis table"],
    ["/players/demo_0_10?role=starter&window=5", ".game-analysis table"],
    ["/players/demo_0_14?role=reliever&window=10", ".game-analysis table"],
    ["/rankings", "form.directory-filters"],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const scripts = new Map();
    const pending = [];
    page.on("response", (response) => {
      if (response.request().resourceType() !== "script") return;
      pending.push(
        response.body().then((body) => {
          scripts.set(response.url(), {
            bytes: body.length,
            gzipBytes: gzipSync(body).length,
          });
        }),
      );
    });
    const started = performance.now();
    await page.goto(base + path);
    await page.locator(ready).first().waitFor();
    const readyMs = performance.now() - started;
    await page.waitForLoadState("load");
    await Promise.all(pending);
    results.push({
      path,
      readyMs: Math.round(readyMs),
      scriptCount: scripts.size,
      jsBytes: [...scripts.values()].reduce((n, s) => n + s.bytes, 0),
      jsGzipEstimateBytes: [...scripts.values()].reduce(
        (n, s) => n + s.gzipBytes,
        0,
      ),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
const report = {
  mode: "production-local-demo",
  samplesPerRoute: 1,
  viewport: "390x844",
  note: "Fresh browser contexts; server may be warm. gzip is an estimate, not transferred bytes. No CPU/network throttling or before/after baseline; not a Web Vitals/SLA result.",
  results,
};
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/momentum-ux-performance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
