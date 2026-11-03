import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [390, 1440]) {
  test(`home fixture, role/window, search and first player navigation at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "좋은 흐름",
    );
    const cards = page.getByTestId("home-rankings").getByRole("link");
    await expect(cards.first()).toBeVisible({ timeout: 30000 });
    await expect(cards).toHaveCount(5);
    await expect(
      page.getByRole("region", { name: "데이터 상태" }),
    ).toContainText("synthetic_v2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "선발", exact: true }).click();
    await page.getByRole("button", { name: "5경기", exact: true }).click();
    await expect(cards.first()).toBeVisible();
    await page.getByRole("button", { name: "3경기", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "3경기", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("tab", { name: "타자", exact: true }).click();
    await page.getByRole("button", { name: "10경기", exact: true }).click();
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await page
      .getByRole("searchbox", { name: "팀·선수 검색" })
      .fill("샘플 A팀");
    await expect(
      page.locator(".home-search").getByRole("link").first(),
    ).toBeVisible();
    await page.getByRole("searchbox", { name: "팀·선수 검색" }).fill("");
    const href = await cards.first().getAttribute("href");
    const name = (await cards.first().getByRole("heading").innerText())
      .replace("↗", "")
      .trim();
    await cards.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  });
}
test("home API validates windows and preserves fixture metadata", async ({
  request,
}) => {
  expect((await request.get("/api/v1/home?window=7")).status()).toBe(400);
  const response = await request.get("/api/v1/home?role=reliever&window=5");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.demo).toBe(true);
  expect(body.players.length).toBeGreaterThan(0);
  expect(
    body.players.every((p: { sampleSize: number }) => p.sampleSize <= 5),
  ).toBe(true);
});

test("home distinguishes score order, unavailable change and fixture cutoff", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "역할별 최근 출전 기세 TOP5" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("home-rankings")
      .getByText("변화량 N/A · 홈 API 미제공")
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(/0–100점은 절대 실력이나 승리확률/),
  ).toBeVisible();
});
