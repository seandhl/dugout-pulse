import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("search, keyboard selection, replacement, scope, reload, URL restore and back", async ({
  page,
}) => {
  await page.goto("/compare");
  await page.getByRole("searchbox", { name: "선수 검색" }).fill("가상 A-01");
  await page.getByRole("searchbox", { name: "선수 검색" }).press("Enter");
  const first = page.getByRole("link", {
    name: "선수 1로 가상 A-01 선택",
    exact: true,
  });
  await first.focus();
  await first.press("Enter");
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toContainText("가상 A-01");
  await page.getByRole("searchbox", { name: "선수 검색" }).fill("가상 A-02");
  await page.getByRole("button", { name: "검색·조건 적용" }).click();
  await page
    .getByRole("link", { name: "선수 2로 가상 A-02 선택", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-02", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "기간", exact: true })
    .selectOption("5");
  await page.getByRole("button", { name: "검색·조건 적용" }).click();
  await expect(page).toHaveURL(/window=5/);
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "기간", exact: true }),
  ).toHaveValue("5");
  await expect(
    page.getByRole("region", { name: "선수 2", exact: true }),
  ).toContainText("표본: 5출전");
  await page
    .getByRole("link", { name: "선수 1로 가상 A-02 선택", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 1: 가상 A-02", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "선수 1: 가상 A-01", exact: true }),
  ).toBeVisible();
  await page.goto("/compare");
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-02", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "대회", exact: true })
    .selectOption("postseason");
  await page.getByRole("button", { name: "검색·조건 적용" }).click();
  await expect(
    page.getByText("해당 시즌·대회 기록 없음 · 비교 제외"),
  ).toBeVisible();
});
test("pitching units, distinct roles, missing values, mobile accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare?players=demo_0_10,demo_0_11&window=5");
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toContainText("ERA (낮을수록 좋음)");
  await expect(
    page
      .getByRole("region", { name: "선수 1", exact: true })
      .getByRole("img", { name: /^ERA/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto(
    "/compare?players=demo_0_12,demo_0_14&role1=reliever&role2=reliever&window=10",
  );
  await expect(
    page.getByRole("combobox", { name: "선수 1 역할", exact: true }),
  ).toHaveValue("reliever");
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toContainText("불펜");
  await page
    .getByRole("combobox", { name: "선수 1 역할", exact: true })
    .selectOption("starter");
  await page
    .getByRole("combobox", { name: "기간", exact: true })
    .selectOption("season");
  await page.getByRole("button", { name: "검색·조건 적용" }).click();
  await expect(page).toHaveURL(/role1=starter/);
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toContainText("시즌 전체");
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toContainText("시즌 기세 미제공");
  await page.goto("/compare?players=demo_0_00,demo_0_14");
  await expect(
    page.locator("p[role=alert]").filter({ hasText: "서로 다른 역할" }),
  ).toContainText("점수/능력의 우열 비교 불가");
  await expect(page.locator(".compare-track")).toHaveCount(0);
  await expect(
    page.getByText("N/A · 결측/기록 부족 · 비교 제외").first(),
  ).toBeVisible();
});

test("rejects manipulated comparison URLs and restores Back/Forward state", async ({
  page,
}) => {
  await page.goto("/compare?players=demo_0_00,demo_0_01,demo_0_02");
  await expect(page.locator("p[role=alert]")).toContainText("최대 2명");
  await expect(page.locator("p[role=alert]")).toContainText("2개 이하");
  await expect(
    page.getByRole("region", { name: "선수 1", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "조건 초기화", exact: true }).click();
  await expect(
    page.getByText("DEMO는 2026 정규시즌만 지원합니다.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "선수 1로 가상 A-01 선택", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 1: 가상 A-01", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "선수 2로 가상 A-02 선택", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-02", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "선수 2: 선택 필요", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-02", exact: true }),
  ).toBeVisible();
  await page.goto("/compare?players=demo_0_00&players=demo_0_01");
  await expect(page.locator("p[role=alert]")).toContainText(
    "비교 조건이 올바르지 않습니다",
  );
  await page.goto("/compare?players=unknown,demo_0_00");
  await expect(
    page.getByText("선수를 찾을 수 없거나 역할이 맞지 않습니다 · 비교 제외"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-01", exact: true }),
  ).toBeVisible();
});

test("R16: 375px bounded immediate picker, paging, selected state, swap and clear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/compare?players=demo_0_00,demo_0_01&window=5");
  const candidates = page
    .getByRole("list", { name: "선수 후보" })
    .locator(":scope > li");
  await expect(candidates).toHaveCount(15);
  await expect(candidates.filter({ hasText: "선택됨" })).toHaveCount(2);
  await page.getByRole("button", { name: "다음 15명 더 보기" }).click();
  await expect(candidates).toHaveCount(15);
  await expect(
    page.getByRole("heading", { name: "검색 결과", exact: true }),
  ).toBeFocused();
  const search = page.getByRole("searchbox", { name: "선수 검색" });
  await search.fill("샘플 A팀");
  await expect(candidates).toHaveCount(14);
  await expect(candidates.first()).toContainText("샘플 A팀");
  await search.fill("불펜");
  await expect(candidates.first()).toContainText("불펜");
  await expect(candidates).toHaveCount(15);
  await search.fill("가상 A-03");
  await expect(candidates).toHaveCount(1);
  const choose = page.getByRole("link", {
    name: "선수 2로 가상 A-03 선택",
    exact: true,
  });
  await choose.focus();
  await choose.press("Enter");
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-03", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "선수 자리 바꾸기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 1: 가상 A-03", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/window=5/);
  const shared = page.url();
  await page.reload();
  await expect(page).toHaveURL(shared);
  await page
    .getByRole("link", { name: "선수 1 선택 해제", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "선수 1: 선택 필요", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "선수 2: 가상 A-01", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("R16: duplicate URL selection stays explicit and never renders comparison bars", async ({
  page,
}) => {
  await page.goto("/compare?players=demo_0_01,demo_0_01&window=5");
  await expect(
    page.getByText("동일 선수입니다. 다른 선수를 선택하세요 · 비교 제외"),
  ).toBeVisible();
  await expect(page.locator(".compare-track")).toHaveCount(0);
});

test("R16: mobile cards and desktop comparison grid retain metric context", async ({
  page,
}, testInfo) => {
  await page.goto("/compare?players=demo_0_10,demo_0_11&window=5");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const first = page.getByRole("region", { name: "선수 1", exact: true });
    const second = page.getByRole("region", { name: "선수 2", exact: true });
    await expect(first).toContainText("표본: 5출전");
    await expect(first).toContainText("ERA (낮을수록 좋음)");
    await expect(first).toContainText("K/9 (높을수록 좋음)");
    await expect(first.locator("time")).toHaveAttribute("datetime", /2026/);
    const a = (await first.boundingBox())!;
    const b = (await second.boundingBox())!;
    if (width === 375) expect(b.y).toBeGreaterThan(a.y + a.height);
    else expect(b.y).toBe(a.y);
    await page.screenshot({
      path: testInfo.outputPath(`r16-compare-${width}.png`),
      fullPage: true,
    });
  }
});

test("R16: swap carries explicit roles with each player", async ({ page }) => {
  await page.goto(
    "/compare?players=demo_0_12,demo_0_01&role1=reliever&role2=batter&window=5&q=가상",
  );
  await page
    .getByRole("link", { name: "선수 자리 바꾸기", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "선수 1 역할", exact: true }),
  ).toHaveValue("batter");
  await expect(
    page.getByRole("combobox", { name: "선수 2 역할", exact: true }),
  ).toHaveValue("reliever");
  await expect(page).toHaveURL(/role1=batter/);
  await expect(page).toHaveURL(/role2=reliever/);
  await expect(page.getByRole("searchbox", { name: "선수 검색" })).toHaveValue(
    "가상",
  );
  await expect(page.locator(".compare-track")).toHaveCount(0);
});
