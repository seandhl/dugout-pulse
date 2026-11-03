import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public routes, absent player, and default-denied admin", async ({
  page,
}) => {
  for (const path of ["/", "/players", "/rankings", "/compare", "/about"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  for (const path of ["/admin", "/admin/login"]) {
    expect((await page.goto(path))?.status()).toBe(403);
  }
  for (const path of ["/players/missing", "/missing"]) {
    const response = await page.goto(path);
    // Next returns 200 after a streamed loading boundary; the API remains 404.
    expect(response?.status()).toBe(path.startsWith("/players/") ? 200 : 404);
    await expect(
      page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]').last()).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});
test("mobile navigation, theme, toast, offline and keyboard entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("본문으로 건너뛰기")).toBeFocused();
  await page.getByRole("switch", { name: "다크 모드" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "개발 상태 확인" }).click();
  await expect(
    page.getByText("DEMO — 가상의 선수와 경기 기록.", { exact: false }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "오프라인입니다" }),
  ).toBeVisible();
});
