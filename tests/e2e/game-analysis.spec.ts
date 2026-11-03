import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("mobile chart uses API numbers, focuses exact DH row, filters, exports and provides accessible table", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const d = await (
    await request.get("/api/v1/players/demo_0_00/batting?window=season")
  ).json();
  await page.goto("/players/demo_0_00?window=season");
  const region = page.getByRole("region", { name: "경기 분석", exact: true });
  await expect(region.getByRole("table")).toBeVisible();
  const game = d.games.find((g: { order: number }) => g.order === 2);
  const point = region.getByRole("button", {
    name: `${game.date} DH ${game.order} ${game.opponent} 누적 ${game.cumulative.metrics.avg.value.toFixed(3)} 상세 행 이동`,
    exact: true,
  });
  await point.focus();
  await expect(region.locator(".analysis-tooltip")).toContainText(
    `PA ${game.counts.pa}`,
  );
  await point.press("Enter");
  const row = region.locator("tr.analysis-selected");
  await expect(row).toBeFocused();
  await expect(row).toContainText(`${game.date} / DH 2`);
  await expect(row).toContainText(game.inputRef);
  await expect(row).toContainText(game.stats.metrics.avg.value.toFixed(3));
  const downloadEvent = page.waitForEvent("download");
  await region.getByRole("button", { name: "표 CSV 내보내기 (DEMO)" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("batting-2026.csv");
  await region.getByLabel("차트 지표").selectOption("ops");
  await expect(region.getByText(/차트 산출 불가:/)).toBeVisible();
  await region.getByLabel("경기 지표 N/A 제외").check();
  await expect(
    region.getByText("선택 조건에 해당하는 경기가 없습니다."),
  ).toBeVisible();
  await region.getByRole("button", { name: "필터 초기화" }).click();
  await region.getByLabel("상대팀 필터").selectOption(game.opponent);
  expect(await region.locator("tbody tr").count()).toBe(
    d.games.filter((g: { opponent: string }) => g.opponent === game.opponent)
      .length,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("pitching chart and raw BF/outs reconcile with table; denied export, long labels, zero and missing values", async ({
  page,
  request,
}) => {
  const d = await (
    await request.get(
      "/api/v1/players/demo_0_10/pitching?role=starter&window=5",
    )
  ).json();
  d.exportPolicy = { demo: false, exportAllowed: false, licenseId: "denied" };
  d.games[0].opponent = "긴상대팀이름".repeat(30);
  d.games[0].stats.metrics.era.value = 0;
  d.games[1].stats.metrics.era.value = null;
  await page.route("**/api/v1/players/*/pitching*", (r) =>
    r.fulfill({ json: d }),
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/players/demo_0_10?role=starter&window=5");
  const region = page.getByRole("region", { name: "경기 분석", exact: true });
  await expect(region.getByRole("table")).toBeVisible();
  await expect(region.getByRole("button", { name: /CSV/ })).toHaveCount(0);
  const point = region.getByRole("button", {
    name: `${d.games[0].date} DH ${d.games[0].order} ${d.games[0].opponent} 경기 0.000 상세 행 이동`,
    exact: true,
  });
  await point.focus();
  await expect(region.locator(".analysis-tooltip")).toContainText(
    `BF ${d.games[0].counts.bf}`,
  );
  await expect(region.locator(".analysis-tooltip")).toContainText(
    `outs ${d.games[0].counts.outsRecorded}`,
  );
  await point.press("Enter");
  await expect(region.locator("tr.analysis-selected")).toContainText("0.000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/analysis-mobile.png",
    fullPage: true,
  });
});

test("period selection announces loading before new results", async ({
  page,
}) => {
  await page.goto("/players/demo_0_00?window=5");
  await expect(
    page.getByRole("region", { name: "경기 분석", exact: true }),
  ).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/players/*/batting?window=10", async (r) => {
    await gate;
    await r.continue();
  });
  await page.getByRole("tab", { name: "최근 10출전", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "타자 상세를 불러오는 중" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("region", { name: "경기 분석", exact: true }),
  ).toBeVisible();
});
