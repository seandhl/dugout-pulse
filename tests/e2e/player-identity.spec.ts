import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 1440]) {
  test(`player identity and card return ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/players?role=starter&sort=score&window=5&team=sample_0");
    const results = page.getByRole("list", { name: "선수 검색 결과" });
    await expect(results.getByRole("link")).toHaveCount(3);
    await expect(results.getByRole("img")).toHaveCount(3);
    await expect(results).toContainText("포지션 미제공");
    await expect(results).toContainText("전체 기세 점수 · 0–100");
    expect(await results.locator("img").count()).toBe(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(results.getByRole("img")).toHaveCount(3);
    await page.screenshot({
      path: `test-results/player-identity-${width}.png`,
      fullPage: true,
    });
    const url = page.url();
    // Clicking card padding activates the same native link as Enter.
    await results
      .locator("li")
      .first()
      .click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(/\/players\/demo_/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(results.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/players\/demo_/);
  });
}

test("home identity and published ranking state", async ({ page }) => {
  await page.goto("/");
  const cards = page.getByTestId("home-rankings");
  await expect(cards.getByRole("img").first()).toBeVisible();
  await expect(cards).toContainText("포지션 미제공");
  await expect(cards).toContainText("기세 점수");
  await page.goto("/rankings");
  const cell = page.locator(".ranking-player-cell").first();
  if ((await cell.count()) === 0) {
    await expect(
      page.getByRole("heading", { name: "기록 미갱신", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("다른 날짜·버전의 점수를 대신 표시하지 않습니다.", {
        exact: false,
      }),
    ).toBeVisible();
    return;
  }
  await expect(cell.getByRole("img")).toBeVisible();
  await expect(cell).toContainText("포지션 미제공");
  await cell.click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL(/\/players\/demo_.*snapshot=/);
});
