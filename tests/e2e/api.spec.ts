import { test, expect } from "@playwright/test";
test("HTTP contract and validation", async ({ request }) => {
  const meta = await request.get("/api/v1/meta");
  expect(meta.status()).toBe(200);
  expect((await meta.json()).meta.sourceMode).toBe("DEMO");
  const list = await request.get("/api/v1/players?limit=1");
  expect(list.status()).toBe(200);
  expect((await list.json()).pagination.hasMore).toBe(true);
  expect((await request.get("/api/v1/players?sort=SQL")).status()).toBe(400);
  expect((await request.get("/api/v1/players/missing")).status()).toBe(404);
});
test("network error and retry", async ({ page }) => {
  await page.route("**/api/v1/player-directory*", (route) => route.abort());
  await page.goto("/players");
  await expect(page.locator("section[role=alert]")).toBeVisible();
  await page.unroute("**/api/v1/player-directory*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }),
  ).toBeVisible();
});
test("seeded player detail and DEMO banner", async ({ page, request }) => {
  const response = await request.get("/api/v1/players/demo_0_00");
  const body = await response.json();
  expect(response.status()).toBe(200);
  expect(body.meta.demo).toBe(true);
  expect(body.data.sampleSize).toBeGreaterThan(0);
  expect(body.data.stats.h).toBeLessThanOrEqual(body.data.stats.ab);
  await page.goto("/players/demo_0_00");
  await expect(page.getByRole("heading", { name: "가상 A-01" })).toBeVisible();
  await expect(page.getByRole("region", { name: "데모 안내" })).toContainText(
    "DEMO — 가상의 선수와 경기 기록",
  );
  await expect(page.getByRole("article", { name: "AVG 요약" })).toContainText(
    "30 AB",
  );
  await page.screenshot({ path: ".demo/player-detail.png", fullPage: true });
});

test("API timeout, empty and partial payloads remain recoverable", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("/api/v1/player-directory")).json();
  let mode: "timeout" | "partial" | "empty" = "timeout";
  await page.route("**/api/v1/player-directory*", async (route) => {
    if (mode === "timeout") return;
    await route.fulfill({
      json:
        mode === "partial"
          ? { players: fixture.players }
          : { ...fixture, players: [], total: 0, pages: 1 },
    });
  });
  await page.goto("/players");
  // Real browser AbortSignal timeout; virtual clocks do not accelerate native signals.
  await expect(page.locator("section[role=alert]")).toBeVisible({
    timeout: 20000,
  });
  mode = "partial";
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator("section[role=alert]")).toContainText("응답 형식");
  mode = "empty";
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("heading", { name: "출전 기록이 없습니다" }),
  ).toBeVisible();
});
