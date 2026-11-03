import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const paths = [
  "/",
  "/players",
  "/players/demo_0_00",
  "/players/demo_0_01",
  "/rankings",
  "/compare?players=demo_0_00,demo_0_03",
  "/about",
  "/privacy",
  "/data-terms",
];
for (const width of [320, 375, 430, 768, 1440]) {
  test(`release responsive and accessibility ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator(".skeleton")).toHaveCount(0);
      if (path === "/players")
        await expect(
          page.getByRole("list", { name: "선수 검색 결과" }),
        ).toBeVisible();
      if (path === "/")
        await expect(page.getByRole("tablist").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).analyze()).violations,
        path,
      ).toEqual([]);
      if (
        [
          "/",
          "/players/demo_0_00",
          "/compare?players=demo_0_00,demo_0_03",
        ].includes(path)
      ) {
        await page.screenshot({
          path: testInfo.outputPath(
            `${width}-${path === "/" ? "home" : path.startsWith("/compare") ? "compare" : "detail"}.png`,
          ),
          fullPage: true,
        });
      }
    }
  });
}
test("score dialog keyboard, reduced motion, retry, empty search and metadata", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "기세 점수 이해하기" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(new URL(canonical!).pathname).toBe("/");
  let fail = true;
  await page.route("**/api/v1/player-directory*", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("/players");
  await expect(page.locator("section[role=alert]")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("존재하지않는선수");
  await expect(
    page.getByRole("heading", { name: "조건에 맞는 선수가 없습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "조건 초기화" }).click();
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }),
  ).toBeVisible();
});
