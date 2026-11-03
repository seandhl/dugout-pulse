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

test("team records match raw traded appearances while explaining global momentum", async ({
  page,
}) => {
  await page.goto("/players?q=가상+A-01&team=sample_0&window=20");
  const results = page.getByRole("list", { name: "선수 검색 결과" });
  await expect(results.getByRole("link")).toHaveCount(1);
  await expect(results).toContainText("2026-10-15");
  await expect(
    page.getByText("팀 필터 후에도 전체 기세 점수입니다.", { exact: false }),
  ).toBeVisible();
  const response = await page.request.get(
    "/api/v1/player-directory?q=가상+A-01&team=sample_0&window=20",
  );
  const body = await response.json();
  expect(body.players[0].lastAppearance).toBe("2026-10-15");
  expect(body.players[0].games).toBeLessThan(20);
});

test("season appearances do not imply roster membership; URL scope is explicit", async ({
  page,
  request,
}) => {
  await page.goto("/players");
  await expect(
    page.getByRole("combobox", { name: "선수 범위", exact: true }),
  ).toHaveValue("appeared");
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }),
  ).toContainText("등록 여부 미확인");
  await expect(
    page.getByText("DEMO는 2026 정규시즌만 지원합니다.", { exact: false }),
  ).toBeVisible();
  const response = await request.get(
    "/api/v1/player-directory?membership=current",
  );
  expect(response.status()).toBe(400);
  await page.goto("/players?membership=current");
  await expect(page.locator("section[role=alert]")).toContainText(
    "유효하지 않은 검색 조건",
  );
  await page.goto("/players?season=2025");
  await expect(page.locator("section[role=alert]")).toContainText(
    "유효하지 않은 검색 조건",
  );
  await page.goto("/players?role=hitter&role=starter");
  await expect(page.locator("section[role=alert]")).toContainText(
    "유효하지 않은 검색 조건",
  );
});

for (const width of [390, 1440])
  test(`directory delayed search, sharing, back and three-action detail ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/player-directory*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page.goto("/players");
    const results = page.getByRole("list", { name: "선수 검색 결과" });
    await expect(results.getByRole("link")).toHaveCount(20);
    const search = page.getByLabel("선수명 검색");
    // One name entry and one link activation reach detail (within three actions).
    await search.fill("가상 A-01");
    await expect(results.getByRole("link")).toHaveCount(1);
    await expect(search).toBeFocused();
    const url = page.url();
    const name = await results.getByRole("link").first().innerText();
    await results.getByRole("link").first().press("Enter");
    await expect(page).toHaveURL(/\/players\/demo_/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(
      results.getByRole("link", { name, exact: true }),
    ).toBeFocused();
    await page.reload();
    await expect(results.getByRole("link")).toHaveCount(1);
    await expect(search).toHaveValue("가상 A-01");
    await page.getByRole("button", { name: "이름: 가상 A-01 ×" }).click();
    await expect(results.getByRole("link")).toHaveCount(20);
    await page
      .getByRole("combobox", { name: "표본 상태", exact: true })
      .selectOption("short");
    await expect(page).toHaveURL(/sample=short/);
    await expect(results).toContainText("선택 경기 수 미달");
    await page.goBack();
    await expect(page).not.toHaveURL(/sample=/);
    await expect(
      page.getByRole("combobox", { name: "표본 상태", exact: true }),
    ).toHaveValue("");
  });

test("page navigation announces results and stale slow responses cannot overwrite search", async ({
  page,
}) => {
  await page.goto("/players");
  const results = page.getByRole("list", { name: "선수 검색 결과" });
  await expect(results.getByRole("link")).toHaveCount(20);
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "검색 결과" }),
  ).toBeFocused();
  await page.route("**/api/v1/player-directory*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "없는")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });
  const search = page.getByLabel("선수명 검색");
  await search.fill("없는");
  await expect(page).toHaveURL(/q=/);
  await search.fill("가상 A-01");
  await expect(results.getByRole("link")).toHaveCount(1);
  await page.waitForTimeout(1700);
  await expect(results.getByRole("link")).toHaveCount(1);
  await expect(page).not.toHaveURL(/page=2/);
});

test("offline failure recovers without changing filters", async ({
  page,
  context,
}) => {
  await page.route("**/api/v1/player-directory*", async (route) => {
    await context.setOffline(true);
    await route.abort("internetdisconnected");
  });
  await page.goto("/players?role=starter");
  await expect(page.locator("section[role=alert]")).toContainText("오프라인");
  await context.setOffline(false);
  await page.unroute("**/api/v1/player-directory*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("list", { name: "선수 검색 결과" }).getByRole("link"),
  ).toHaveCount(20);
  await expect(page).toHaveURL(/role=starter/);
});

test("shared URL, direct page jump, sort scroll and clamped page stay reproducible", async ({
  page,
}) => {
  await page.goto("/players?page=99999&sort=games");
  const results = page.getByRole("list", { name: "선수 검색 결과" });
  await expect(page).not.toHaveURL(/99999/);
  await expect(results.getByRole("link").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "페이지 바로 이동" })
    .selectOption("2");
  await expect(page).toHaveURL(/page=2/);
  await expect(results.getByRole("link")).toHaveCount(20);
  const names = await results.getByRole("link").allTextContents();
  const sharedUrl = page.url();
  page.once("dialog", async (dialog) => {
    expect(dialog.defaultValue()).toBe(sharedUrl);
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "필터 URL 공유" }).click();
  await page.goto(sharedUrl);
  await expect(results.getByRole("link")).toHaveText(names);
  await page.getByRole("combobox", { name: "정렬", exact: true }).focus();
  const y = await page.evaluate(() => window.scrollY);
  await page
    .getByRole("combobox", { name: "정렬", exact: true })
    .selectOption("name");
  await expect(page).not.toHaveURL(/page=2/);
  await expect(results.getByRole("link")).toHaveCount(20);
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - y),
  ).toBeLessThan(4);
});
