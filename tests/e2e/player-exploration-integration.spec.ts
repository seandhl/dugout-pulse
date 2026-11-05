import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 768, 1440])
  for (const theme of ["light", "dark"] as const) {
    test(`filtered directory to season and explicit return ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      await page.goto(
        "/players?q=가상&role=starter&sort=score&window=5&team=sample_0",
      );
      const results = page.getByRole("list", { name: "선수 검색 결과" });
      await expect(results.getByRole("link")).toHaveCount(3);
      const first = results.getByRole("link").first();
      await first.scrollIntoViewIfNeeded();
      await first.focus();
      const y = await page.evaluate(() => scrollY);
      const directoryURL = new URL(page.url());
      await first.press("Enter");
      await page.getByRole("tab", { name: "시즌 기록", exact: true }).click();
      await expect(page).toHaveURL(/tab=season/);
      await page.reload();
      await expect(
        page.getByRole("tab", { name: "시즌 기록", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("region", { name: "시즌 일반 기록" }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/exploration-${width}-${theme}.png`,
        fullPage: true,
        style: "nextjs-portal { display:none !important; }",
      });
      await page
        .getByRole("link", { name: "← 선수 목록으로", exact: true })
        .click();
      await expect(results.getByRole("link")).toHaveCount(3);
      const params = new URL(page.url()).searchParams;
      for (const key of ["q", "role", "sort", "window", "team"])
        expect(params.get(key)).toBe(directoryURL.searchParams.get(key));
      await expect(first).toBeFocused();
      expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThan(
        5,
      );
    });
  }

for (const [id, kind, role] of [
  ["demo_0_00", "batting", "타자"],
  ["demo_0_10", "pitching", "투수"],
]) {
  test(`${role} loading and offline recovery retain selected season tab`, async ({
    page,
    context,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/v1/players/*/${kind}*`, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`/players/${id}?tab=season`);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `${role} 상세를 불러오는 중` }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("region", { name: "시즌 일반 기록" }),
    ).toBeVisible();
    await page.unroute(`**/api/v1/players/*/${kind}*`);
    await page.route(`**/api/v1/players/*/${kind}*`, async (route) => {
      await context.setOffline(true);
      await route.abort("internetdisconnected");
    });
    await page.reload();
    await expect(page.locator("section[role=alert]")).toContainText("오프라인");
    await context.setOffline(false);
    await page.unroute(`**/api/v1/players/*/${kind}*`);
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(
      page.getByRole("region", { name: "시즌 일반 기록" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "시즌 기록", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

test("ambiguous detail addresses and foreign return targets are rejected", async ({
  page,
}) => {
  await page.goto("/players/demo_0_00?tab=season&tab=momentum");
  await expect(page.locator("section[role=alert]")).toContainText(
    "유효하지 않은 상세 탭",
  );
  await page.getByRole("button", { name: "기세 분석으로" }).click();
  await expect(
    page.getByRole("tab", { name: "기세 분석", exact: true }),
  ).toBeVisible();
  await page.goto("/players/demo_0_00?snapshot=a&snapshot=b");
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
  ).toBeVisible();
  await page.goto(
    "/players/demo_0_00?returnTo=https%3A%2F%2Fexample.com%2Fplayers",
  );
  await expect(
    page.getByRole("link", { name: "← 선수 목록으로", exact: true }),
  ).toHaveAttribute("href", /^\/players\?releaseId=/);
});

test("home search and excluded players retain avatar, role, score and demo context", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "팀·선수 검색" }).fill("가상 A-01");
  const result = page.locator(".home-search").getByRole("link").first();
  await expect(result.getByRole("img")).toBeVisible();
  await expect(result).toContainText("포지션 미제공 · 기세");
  await expect(result).toContainText("DEMO");
  await result.press("Enter");
  await expect(
    page.getByRole("heading", { name: "가상 A-01", exact: true }),
  ).toBeVisible();
});
