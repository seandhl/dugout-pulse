import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("detail API matches cards; period keyboard, missing data and compare", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/players/demo_0_00?window=5");
  const d = await (
    await request.get("/api/v1/players/demo_0_00/batting?window=5")
  ).json();
  await expect(page.getByRole("article", { name: "AVG 요약" })).toContainText(
    d.recent.metrics.avg.value.toFixed(3),
  );
  await expect(page.getByRole("article", { name: "OPS 요약" })).toContainText(
    "N/A",
  );
  const tab = page.getByRole("tab", { name: "최근 5출전", exact: true });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/window=10/);
  await expect(page.getByRole("article", { name: "AVG 요약" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/player-detail-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "선수 비교에 추가" }).click();
  await expect(page).toHaveURL(/compare\?players=demo_0_00/);
  await expect(
    page.getByRole("heading", { name: "선수 1: 가상 A-01", exact: true }),
  ).toBeVisible();
});
test("desktop season and network retry", async ({ page }) => {
  await page.route("**/api/v1/players/*/batting*", (r) =>
    r.fulfill({ status: 503, json: { error: "연결 실패" } }),
  );
  await page.goto("/players/demo_0_00?window=season");
  await expect(page.locator("section[role=alert]")).toContainText("연결 실패");
  await page.unroute("**/api/v1/players/*/batting*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("heading", { name: "최근 출전 기세" }),
  ).toBeVisible();
  await expect(
    page.getByText("시즌 전체는 기세 모델 기간이 아닙니다."),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/player-detail-desktop.png",
    fullPage: true,
  });
});
