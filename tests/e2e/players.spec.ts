import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [390, 1440])
  test(`directory URL, filters, keyboard and accessibility ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/players?role=starter&sort=era&window=5&team=sample_0");
    const results = page.getByRole("list", { name: "선수 검색 결과" });
    await expect(results.getByRole("link")).toHaveCount(3, { timeout: 30000 });
    await expect(
      page.getByRole("combobox", { name: "역할", exact: true }),
    ).toHaveValue("starter");
    await results.getByRole("link").first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(results.getByRole("link").nth(1)).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/players-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(results.getByRole("link")).toHaveCount(3, { timeout: 30000 });
    const search = page.getByLabel("선수명 검색");
    await search.dispatchEvent("compositionstart");
    await search.fill("없는선수");
    await page.waitForTimeout(450);
    await expect(page).not.toHaveURL(/q=/);
    await search.dispatchEvent("compositionend");
    await expect(page).toHaveURL(/q=/);
    await expect(
      page.getByRole("heading", { name: "조건에 맞는 선수가 없습니다" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "조건 초기화" }).click();
    await expect(results.getByRole("link")).toHaveCount(20, { timeout: 30000 });
    await page.getByRole("button", { name: "다음 페이지" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(results.getByRole("link")).toHaveCount(20, { timeout: 30000 });
  });
test("directory server failure and retry", async ({ page }) => {
  await page.route("**/api/v1/player-directory*", (route) =>
    route.fulfill({ status: 503, json: { error: "테스트 서버 오류" } }),
  );
  await page.goto("/players");
  await expect(page.locator("section[role=alert]")).toContainText(
    "테스트 서버 오류",
  );
  await page.unroute("**/api/v1/player-directory*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }).getByRole("link"),
  ).toHaveCount(20, { timeout: 30000 });
});
