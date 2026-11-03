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
  ).toContainText("sample count: 5출전");
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
    page.getByRole("alert").filter({ hasText: "서로 다른 역할" }),
  ).toContainText("점수/능력의 우열 비교 불가");
  await expect(page.locator(".compare-track")).toHaveCount(0);
  await expect(
    page.getByText("N/A · 결측/기록 부족 · 비교 제외").first(),
  ).toBeVisible();
});
