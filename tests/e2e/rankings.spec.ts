import { expect, test } from "@playwright/test";
test("rankings makes missing snapshots explicit and preserves filter URLs", async ({
  page,
}) => {
  await page.goto("/rankings?date=1900-01-01");
  await expect(
    page.getByRole("heading", { name: "기세 랭킹", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "기록 미갱신", exact: true }),
  ).toBeVisible();
  for (const role of ["타자", "선발", "불펜"])
    await expect(
      page.getByRole("heading", { name: `${role} 순위` }),
    ).toBeVisible();
  await page.getByText("정렬과 변화량 계산 기준", { exact: true }).click();
  await expect(page.getByText(/반올림 전 원값으로 정렬/)).toBeVisible();
  await page.getByRole("link", { name: "하락 변화", exact: true }).click();
  const response = await page.request.get(
    "/api/v1/rankings?role=hitter&window=10&date=1900-01-01&sort=decline&page=1",
  );
  expect(response.ok()).toBe(true);
  expect((await response.json()).data).toEqual([]);
  await expect(page).toHaveURL(/date=1900-01-01.*sort=decline/);
  await page.getByLabel("기간 N").selectOption("5");
  await page.getByRole("button", { name: "조건 적용" }).click();
  await expect(page).toHaveURL(/window=5/);
  await expect(
    page.getByRole("heading", { name: "기록 미갱신", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("invalid ranking URLs offer reset", async ({ page }) => {
  await page.goto("/rankings?window=7");
  await expect(
    page.getByRole("heading", { name: "유효하지 않은 랭킹 조건" }),
  ).toBeVisible();
});
